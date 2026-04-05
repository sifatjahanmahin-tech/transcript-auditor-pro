"""
OCR Scanner Module — Image-to-text transcript extraction.

Uses Tesseract OCR with OpenCV preprocessing for maximum accuracy
on scanned NSU transcript images. Includes:
  - Image enhancement (deskew, denoise, contrast)
  - Text extraction with confidence scoring
  - Structured transcript parsing from raw OCR text
"""

import io
import os
import re
import tempfile
from pathlib import Path
from typing import List, Optional, Tuple

import cv2
import numpy as np
from PIL import Image

from backend.config import get_settings

settings = get_settings()

# Configure Tesseract path if specified
try:
    import pytesseract

    if settings.TESSERACT_CMD:
        pytesseract.pytesseract.tesseract_cmd = settings.TESSERACT_CMD
except ImportError:
    pytesseract = None  # type: ignore


class OCRError(Exception):
    """Custom exception for OCR processing failures."""
    pass


def preprocess_image(image_bytes: bytes) -> np.ndarray:
    """
    Apply preprocessing pipeline to improve OCR accuracy.

    Steps:
        1. Convert to grayscale
        2. Denoise
        3. Apply adaptive thresholding
        4. Deskew
        5. Scale up if too small

    Args:
        image_bytes: Raw image file bytes.

    Returns:
        Preprocessed OpenCV image array.

    Raises:
        OCRError: If the image cannot be decoded.
    """
    # Decode image
    nparr = np.frombuffer(image_bytes, np.uint8)
    img = cv2.imdecode(nparr, cv2.IMREAD_COLOR)

    if img is None:
        raise OCRError("Failed to decode image. Ensure the file is a valid image format.")

    # Convert to grayscale
    gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)

    # Scale up small images (OCR works better on larger images)
    height, width = gray.shape
    if width < 1000:
        scale_factor = 1500 / width
        gray = cv2.resize(
            gray,
            None,
            fx=scale_factor,
            fy=scale_factor,
            interpolation=cv2.INTER_CUBIC,
        )

    # Denoise
    denoised = cv2.fastNlMeansDenoising(gray, h=10, templateWindowSize=7, searchWindowSize=21)

    # Adaptive threshold for handling variable lighting
    thresh = cv2.adaptiveThreshold(
        denoised, 255,
        cv2.ADAPTIVE_THRESH_GAUSSIAN_C,
        cv2.THRESH_BINARY,
        blockSize=11,
        C=2,
    )

    # Deskew
    deskewed = _deskew(thresh)

    return deskewed


def _deskew(image: np.ndarray) -> np.ndarray:
    """
    Correct rotation/skew in a scanned document.

    Uses Hough Line Transform to detect dominant line angle,
    then rotates to correct.
    """
    edges = cv2.Canny(image, 50, 150, apertureSize=3)
    lines = cv2.HoughLinesP(edges, 1, np.pi / 180, threshold=100, minLineLength=100, maxLineGap=10)

    if lines is None or len(lines) == 0:
        return image

    angles = []
    for line in lines:
        x1, y1, x2, y2 = line[0]
        angle = np.degrees(np.arctan2(y2 - y1, x2 - x1))
        if abs(angle) < 15:  # Only consider near-horizontal lines
            angles.append(angle)

    if not angles:
        return image

    median_angle = np.median(angles)
    if abs(median_angle) < 0.5:  # Skip if already straight
        return image

    h, w = image.shape[:2]
    center = (w // 2, h // 2)
    rotation_matrix = cv2.getRotationMatrix2D(center, median_angle, 1.0)
    rotated = cv2.warpAffine(
        image, rotation_matrix, (w, h),
        flags=cv2.INTER_CUBIC,
        borderMode=cv2.BORDER_REPLICATE,
    )

    return rotated


def extract_text(image_bytes: bytes) -> Tuple[str, float]:
    """
    Extract text from an image using Tesseract OCR.

    Args:
        image_bytes: Raw image file bytes.

    Returns:
        Tuple of (extracted_text, average_confidence).

    Raises:
        OCRError: If Tesseract is not installed or extraction fails.
    """
    if pytesseract is None:
        raise OCRError(
            "pytesseract is not installed. "
            "Install it with: pip install pytesseract\n"
            "Also ensure Tesseract OCR is installed on your system."
        )

    try:
        # Preprocess
        processed = preprocess_image(image_bytes)

        # Convert to PIL Image for pytesseract
        pil_image = Image.fromarray(processed)

        # Extract with confidence data
        data = pytesseract.image_to_data(pil_image, output_type=pytesseract.Output.DICT)

        # Calculate average confidence (excluding -1 entries)
        confidences = [c for c in data["conf"] if int(c) > 0]
        avg_confidence = sum(int(c) for c in confidences) / len(confidences) if confidences else 0.0

        # Extract plain text
        text = pytesseract.image_to_string(pil_image, config="--psm 6")

        return text.strip(), round(avg_confidence, 2)

    except Exception as e:
        if "TesseractNotFoundError" in type(e).__name__:
            raise OCRError(
                "Tesseract OCR not found. Install it:\n"
                "  Windows: Download from https://github.com/UB-Mannheim/tesseract/wiki\n"
                "  macOS/Linux: brew install tesseract / sudo apt install tesseract-ocr"
            )
        raise OCRError(f"OCR extraction failed: {str(e)}")


def parse_transcript_from_text(raw_text: str) -> List[dict]:
    """
    Parse structured transcript data from raw OCR text.

    Attempts to extract rows matching the pattern:
        COURSE_CODE  Course Name  GRADE  CREDITS  SEMESTER

    This uses heuristic regex patterns tuned for NSU transcript format.

    Args:
        raw_text: Raw text extracted via OCR.

    Returns:
        List of dicts with keys: course_code, course_name, grade, credits, semester.
    """
    entries = []
    lines = raw_text.split("\n")

    # Pattern: Course code (letters + digits), then course name, then grade, credits, semester
    # NSU format example: "CSE115  Programming Language I  A  3  Fall 2022"
    course_code_pattern = re.compile(
        r"^([A-Z]{2,4}\s?\d{3}[A-Z]?)\s+"   # Course code
        r"(.+?)\s+"                           # Course name (greedy-lazy)
        r"([A-F][+-]?|W|I)\s+"                # Grade
        r"(\d+(?:\.\d+)?)\s+"                 # Credits
        r"((?:Fall|Spring|Summer)\s+\d{4})",  # Semester
        re.IGNORECASE,
    )

    # Alternate pattern: tab-separated or multi-space separated
    alt_pattern = re.compile(
        r"([A-Z]{2,4}\s?\d{3}[A-Z]?)"   # Course code
        r"[\t|]+\s*"
        r"(.+?)"                          # Course name
        r"[\t|]+\s*"
        r"([A-F][+-]?|W|I)"              # Grade
        r"[\t|]+\s*"
        r"(\d+(?:\.\d+)?)"              # Credits
        r"[\t|]+\s*"
        r"((?:Fall|Spring|Summer)\s+\d{4})",
        re.IGNORECASE,
    )

    for line in lines:
        line = line.strip()
        if not line:
            continue

        match = course_code_pattern.match(line)
        if not match:
            match = alt_pattern.match(line)

        if match:
            code = re.sub(r"\s+", "", match.group(1)).upper()
            entries.append({
                "course_code": code,
                "course_name": match.group(2).strip(),
                "grade": match.group(3).strip().upper(),
                "credits": float(match.group(4).strip()),
                "semester": match.group(5).strip(),
            })

    return entries


def validate_file_extension(filename: str) -> bool:
    """Check if the file has an allowed image extension."""
    ext = Path(filename).suffix.lower()
    return ext in settings.OCR_ALLOWED_EXTENSIONS


def validate_file_size(content_length: int) -> bool:
    """Check if the file is within the allowed size limit."""
    max_bytes = settings.OCR_MAX_FILE_SIZE_MB * 1024 * 1024
    return content_length <= max_bytes
