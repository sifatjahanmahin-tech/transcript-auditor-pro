"""
Audit routes — CSV upload, image/OCR upload, and audit execution.

All audit operations require authentication and are logged to history.
"""

import csv
import io
import os
import sys

from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile, status
from sqlalchemy.ext.asyncio import AsyncSession

# Add project root for engine imports
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from backend.auth import get_current_user
from backend.database import AuditRecord, User, get_db
from backend.ocr_scanner import (
    OCRError,
    extract_text,
    parse_transcript_from_text,
    validate_file_extension,
    validate_file_size,
)
from backend.schemas import AuditResultResponse, CourseEntry, OCRResultResponse
from engine.audit_engine import run_audit
from models.data_models import TranscriptEntry
from parsers.program_parser import parse_program

router = APIRouter(prefix="/api/audit", tags=["Audit"])

# Path to program definitions — go up 3 levels: routes/ -> backend/ -> project root
_PROJECT_ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
PROGRAM_FILE = os.path.join(_PROJECT_ROOT, "program.md")
DATA_PROGRAM_FILE = os.path.join(_PROJECT_ROOT, "data", "program.md")


def _get_program_file() -> str:
    """Find the program.md file."""
    for path in [PROGRAM_FILE, DATA_PROGRAM_FILE]:
        if os.path.isfile(path):
            return path
    raise HTTPException(
        status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
        detail="Program requirements file not found on server.",
    )


def _entries_to_dicts(entries: list[TranscriptEntry]) -> list[dict]:
    """Convert TranscriptEntry objects to serializable dicts."""
    return [
        {
            "course_code": e.course_code,
            "course_name": e.course_name,
            "grade": e.grade,
            "credits": e.credits,
            "semester": e.semester,
        }
        for e in entries
    ]


def _dicts_to_entries(data: list[dict]) -> list[TranscriptEntry]:
    """Convert dicts back to TranscriptEntry objects."""
    return [
        TranscriptEntry(
            course_code=d["course_code"],
            course_name=d.get("course_name", ""),
            grade=d.get("grade", ""),
            credits=float(d.get("credits", 0)),
            semester=d.get("semester", ""),
        )
        for d in data
    ]


@router.post("/csv", response_model=AuditResultResponse, status_code=status.HTTP_201_CREATED)
async def audit_from_csv(
    file: UploadFile = File(..., description="Transcript CSV file"),
    program_name: str = Form(..., description="Degree program name"),
    waived_courses: str = Form("", description="Comma-separated course codes to waive"),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """
    Upload a CSV transcript and run a full degree audit.

    The CSV must have columns: course_code, course_name, grade, credits, semester.
    Results are saved to history automatically.
    """
    # Validate file type
    if not file.filename or not file.filename.lower().endswith(".csv"):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="File must be a CSV file (.csv extension).",
        )

    # Read and parse CSV
    try:
        content = await file.read()
        text = content.decode("utf-8-sig")

        # Parse CSV content into TranscriptEntry objects
        reader = csv.DictReader(io.StringIO(text))
        if reader.fieldnames:
            reader.fieldnames = [h.strip().lower() for h in reader.fieldnames]

        entries: list[TranscriptEntry] = []
        for row in reader:
            cleaned = {k.strip().lower(): (v.strip() if v else "") for k, v in row.items()}
            course_code = cleaned.get("course_code", cleaned.get("course code", "")).upper()
            if not course_code:
                continue

            grade = cleaned.get("grade", "").strip().upper().replace(" ", "")
            credits_raw = cleaned.get("credits", "0").strip()
            try:
                credits = float(credits_raw) if credits_raw else 0.0
            except ValueError:
                credits = 0.0

            entries.append(
                TranscriptEntry(
                    course_code=course_code,
                    course_name=cleaned.get("course_name", cleaned.get("course name", "")),
                    grade=grade,
                    credits=credits,
                    semester=cleaned.get("semester", ""),
                )
            )

    except UnicodeDecodeError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="File encoding error. Please upload a UTF-8 encoded CSV.",
        ) from e
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Failed to parse CSV: {str(e)}",
        ) from e

    if not entries:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="No valid transcript entries found in the CSV file.",
        )

    # Parse waived courses
    waived_set = set()
    if waived_courses.strip():
        waived_set = {code.strip().upper() for code in waived_courses.split(",") if code.strip()}

    # Get program requirements
    program_path = _get_program_file()
    try:
        program = parse_program(program_path, program_name)
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e)) from e

    # Run audit
    result = run_audit(entries, program, waived_set)

    # Save to history
    record = AuditRecord(
        user_id=current_user.id,
        input_type="csv",
        original_filename=file.filename,
        program_name=program_name,
        total_valid_credits=result.total_valid_credits,
        cgpa=result.cgpa,
        on_probation=result.on_probation,
        credit_breakdown=result.credit_breakdown,
        missing_courses=result.missing_courses,
        completed_courses=result.completed_courses,
        waived_courses=result.waived_courses,
        parsed_entries=_entries_to_dicts(entries),
    )
    db.add(record)
    await db.commit()
    await db.refresh(record)

    return AuditResultResponse.model_validate(record)


@router.post("/image", response_model=AuditResultResponse, status_code=status.HTTP_201_CREATED)
async def audit_from_image(
    file: UploadFile = File(..., description="Scanned transcript image"),
    program_name: str = Form(..., description="Degree program name"),
    waived_courses: str = Form("", description="Comma-separated course codes to waive"),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """
    Upload a scanned transcript image, run OCR, and execute a full audit.

    Supported formats: PNG, JPG, JPEG, TIFF, BMP, PDF.
    """
    # Validate file
    if not file.filename:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="No file provided.")

    if not validate_file_extension(file.filename):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Unsupported file format. Allowed: {', '.join(['.png', '.jpg', '.jpeg', '.tiff', '.bmp'])}",
        )

    # Read image
    image_bytes = await file.read()
    if not validate_file_size(len(image_bytes)):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="File too large. Maximum size is 10 MB.",
        )

    # Run OCR
    try:
        raw_text, confidence = extract_text(image_bytes)
    except OCRError as e:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail=str(e)) from e

    if not raw_text.strip():
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="OCR could not extract any text from the image. Try a clearer scan.",
        )

    # Parse transcript from OCR text
    parsed_data = parse_transcript_from_text(raw_text)
    if not parsed_data:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="Could not parse transcript entries from OCR text. The image may not be a recognized transcript format.",
        )

    entries = _dicts_to_entries(parsed_data)

    # Parse waived courses
    waived_set = set()
    if waived_courses.strip():
        waived_set = {code.strip().upper() for code in waived_courses.split(",") if code.strip()}

    # Get program requirements
    program_path = _get_program_file()
    try:
        program = parse_program(program_path, program_name)
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e)) from e

    # Run audit
    result = run_audit(entries, program, waived_set)

    # Save to history
    record = AuditRecord(
        user_id=current_user.id,
        input_type="image",
        original_filename=file.filename,
        program_name=program_name,
        total_valid_credits=result.total_valid_credits,
        cgpa=result.cgpa,
        on_probation=result.on_probation,
        credit_breakdown=result.credit_breakdown,
        missing_courses=result.missing_courses,
        completed_courses=result.completed_courses,
        waived_courses=result.waived_courses,
        parsed_entries=parsed_data,
        ocr_raw_text=raw_text,
    )
    db.add(record)
    await db.commit()
    await db.refresh(record)

    response = AuditResultResponse.model_validate(record)
    response.ocr_confidence = confidence
    return response


@router.post("/ocr-preview", response_model=OCRResultResponse)
async def ocr_preview(
    file: UploadFile = File(..., description="Image to preview OCR results"),
    current_user: User = Depends(get_current_user),
):
    """
    Preview OCR extraction without running audit.
    Useful for verifying OCR accuracy before committing.
    """
    if not file.filename:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="No file provided.")

    if not validate_file_extension(file.filename):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Unsupported file format.",
        )

    image_bytes = await file.read()

    try:
        raw_text, confidence = extract_text(image_bytes)
    except OCRError as e:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail=str(e)) from e

    parsed = parse_transcript_from_text(raw_text)

    parsed_entries = [
        CourseEntry(
            course_code=d.get("course_code", ""),
            course_name=d.get("course_name", ""),
            grade=d.get("grade", ""),
            credits=float(d.get("credits", 0)),
            semester=d.get("semester", ""),
        )
        for d in parsed
    ]

    return OCRResultResponse(
        raw_text=raw_text,
        confidence=confidence,
        parsed_entries=parsed_entries,
        entry_count=len(parsed_entries),
    )
