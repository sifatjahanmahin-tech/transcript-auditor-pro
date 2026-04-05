import csv
import os
import random

# Configuration
BASE_DATA_DIR = os.path.join("tests", "data", "generated_functional")
COMPONENTS = ["parsers", "credit", "cgpa", "audit"]

# Setup directories
for comp in COMPONENTS:
    path = os.path.join(BASE_DATA_DIR, comp)
    if not os.path.exists(path):
        os.makedirs(path)

GRADES = ["A", "A-", "B+", "B", "B-", "C+", "C", "C-", "D+", "D", "F", "W", "I"]
YEARS = [2021, 2022, 2023, 2024, 2025]
SEMESTERS = ["Spring", "Summer", "Fall"]

def write_csv(filepath, rows):
    header = ["course_code", "course_name", "grade", "credits", "semester"]
    with open(filepath, "w", newline="", encoding="utf-8") as f:
        writer = csv.writer(f)
        writer.writerow(header)
        writer.writerows(rows)

# 1. PARSERS (100 files)
print("Generating Parser tests...")
for i in range(100):
    filename = f"parser_test_{i}.csv"
    rows = []
    # Mix of messy data: extra spaces, mixed case, special chars
    course_code = random.choice(["cse115", " MAT116 ", "eng102", "HIS 103"])
    course_name = f"Test Course {i} !@#"
    grade = random.choice(["a", " B+", "f ", "W", ""])
    credits = random.choice(["3.0", " 3", "4.0 ", "abc", ""])
    semester = f"{random.choice(SEMESTERS)} {random.choice(YEARS)}"
    
    rows.append([course_code, course_name, grade, credits, semester])
    write_csv(os.path.join(BASE_DATA_DIR, "parsers", filename), rows)

# 2. CREDIT ENGINE (150 files)
print("Generating Credit Engine tests...")
for i in range(150):
    filename = f"credit_test_{i}.csv"
    rows = []
    # Scenarios: complex retakes, non-credit grades
    num_courses = random.randint(2, 5)
    for j in range(num_courses):
        code = f"CSE{100+j}"
        # Randomly add retakes for level 1
        for _ in range(random.randint(1, 3)):
            rows.append([code, "Course Name", random.choice(GRADES), 3.0, f"Sem {random.randint(1,5)}"])
    
    write_csv(os.path.join(BASE_DATA_DIR, "credit", filename), rows)

# 3. CGPA ENGINE (150 files)
print("Generating CGPA Engine tests...")
for i in range(150):
    filename = f"cgpa_test_{i}.csv"
    rows = []
    # Scenarios: varying credits, weighting
    num_courses = random.randint(5, 15)
    for j in range(num_courses):
        code = f"MAT{200+j}"
        credits = random.choice([1.0, 3.0, 4.0])
        grade = random.choice(GRADES)
        rows.append([code, "Math Course", grade, credits, "Fall 2023"])
    
    write_csv(os.path.join(BASE_DATA_DIR, "cgpa", filename), rows)

# 4. AUDIT ENGINE (100+ files)
print("Generating Audit Engine tests...")
for i in range(110): # Total 510 files
    filename = f"audit_test_{i}.csv"
    rows = []
    # Mixed data for full audit flow
    num_courses = random.randint(10, 40)
    for j in range(num_courses):
        code = random.choice(["CSE", "MAT", "ENG", "HIS"]) + str(random.randint(100, 499))
        rows.append([code, "Audit Course", random.choice(GRADES), 3.0, "Spring 2024"])
    
    write_csv(os.path.join(BASE_DATA_DIR, "audit", filename), rows)

print(f"Done! Generated 510 files in {BASE_DATA_DIR}")
