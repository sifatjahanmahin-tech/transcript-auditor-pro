import csv
import os
import random
import re

# Output directory
DATA_DIR = "stress_test_data"
if not os.path.exists(DATA_DIR):
    os.makedirs(DATA_DIR)

# Possible grades
GRADES = ["A", "A-", "B+", "B", "B-", "C+", "C", "C-", "D+", "D", "F", "W", "I", "S", "U"]
SEMESTERS = ["Spring", "Summer", "Fall"]
YEARS = [2020, 2021, 2022, 2023, 2024, 2025]

def get_courses_from_program(filepath):
    courses = []
    if not os.path.exists(filepath):
        return ["CSE115", "CSE215", "MAT116", "ENG102", "HIS103"]
    with open(filepath, "r") as f:
        content = f.read()
        # Find all codes like CSE115, EEE141
        matches = re.findall(r"([A-Z]{3}\d{3})", content)
        courses = list(set(matches))
    return courses

COURSES = get_courses_from_program("program.md")

def generate_student_transcript(filename, scenario):
    rows = []
    
    if scenario == "extreme_retakes":
        # Retake a few courses many times
        retake_courses = random.sample(COURSES, k=min(3, len(COURSES)))
        for course in retake_courses:
            for i in range(random.randint(5, 8)):
                rows.append([
                    course,
                    3.0,
                    random.choice(GRADES),
                    f"{random.choice(SEMESTERS)} {random.choice(YEARS)}"
                ])
    
    elif scenario == "credit_extremes_low":
        # 0 or 1 course
        if random.choice([True, False]): # 0 credits
            pass
        else: # 1 course
            rows.append([random.choice(COURSES), 3.0, "A", "Spring 2023"])
            
    elif scenario == "credit_extremes_high":
        # 200+ credits
        for _ in range(70): 
            rows.append([
                random.choice(COURSES),
                3.0,
                random.choice(GRADES),
                f"{random.choice(SEMESTERS)} {random.choice(YEARS)}"
            ])

    else: # normal_messy
        num_entries = random.randint(10, 50)
        for _ in range(num_entries):
            rows.append([
                random.choice(COURSES),
                random.choice([0.0, 1.0, 3.0, 4.0]),
                random.choice(GRADES),
                f"{random.choice(SEMESTERS)} {random.choice(YEARS)}"
            ])

    # Ensure uniqueness of headers/rows etc
    with open(os.path.join(DATA_DIR, filename), "w", newline="") as f:
        writer = csv.writer(f)
        writer.writerow(["Course_Code", "Credits", "Grade", "Semester"])
        writer.writerows(rows)

print(f"Generating 2000+ transcripts in {DATA_DIR}...")
for i in range(2005):
    if i < 200:
        scenario = "extreme_retakes"
    elif i < 300:
        scenario = "credit_extremes_low"
    elif i < 400:
        scenario = "credit_extremes_high"
    else:
        scenario = "normal_messy"
    
    generate_student_transcript(f"student_{i}.csv", scenario)

print("Done.")
