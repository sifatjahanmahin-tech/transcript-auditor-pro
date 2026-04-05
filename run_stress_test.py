import os
import subprocess
import re
import time
import random
import sys

DATA_DIR = "stress_test_data"
PROGRAMS = ["Computer Science & Engineering", "Electrical & Computer Engineering"]
AUDIT_TOOL = "audit_tool.py"
PROGRAM_MD = "program.md"

files = [f for f in os.listdir(DATA_DIR) if f.endswith(".csv")]
total_files = len(files)

pass_count = 0
fail_count = 0
results = []

print(f"Starting stress test for {total_files} files...")
start_time = time.time()

for i, filename in enumerate(files):
    filepath = os.path.join(DATA_DIR, filename)
    program = random_program = random.choice(PROGRAMS)
    
    # Run the tool in non-interactive mode
    try:
        process = subprocess.Popen(
            [sys.executable, AUDIT_TOOL, filepath, program, PROGRAM_MD, "--no-interactive"],
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
            text=True,
            encoding='utf-8',
            errors='replace'
        )
        stdout, stderr = process.communicate(timeout=10)
        
        status = "PASS"
        error_msg = ""
        
        # Check for crash
        if process.returncode != 0:
            status = "FAIL (Crash)"
            error_msg = f"Code {process.returncode}: {stderr.strip()[:1000]}"
        
        # Check for impossible CGPA
        cgpa_match = re.search(r"Cumulative GPA: ([\d\.]+)", stdout)
        if cgpa_match:
            try:
                cgpa = float(cgpa_match.group(1))
                if cgpa < 0.0 or cgpa > 4.0:
                    status = "FAIL (Math Error)"
                    error_msg = f"CGPA: {cgpa}"
            except ValueError:
                status = "FAIL (Format Error)"
                error_msg = f"Invalid CGPA string: {cgpa_match.group(1)}"
        
        if status == "PASS":
            pass_count += 1
        else:
            fail_count += 1
            results.append(f"{filename} | {program} | {status} | {error_msg}")
            
    except subprocess.TimeoutExpired:
        process.kill()
        fail_count += 1
        results.append(f"{filename} | {program} | FAIL (Timeout) | Took too long")
    except Exception as e:
        fail_count += 1
        results.append(f"{filename} | {program} | FAIL (Runner Exception) | {str(e)[:100]}")

    if (i + 1) % 100 == 0:
        print(f"Processed {i + 1}/{total_files}...")

end_time = time.time()
duration = end_time - start_time

# Write Report
report_content = f"""# Massive Stress Test Report

- **Date**: {time.strftime("%Y-%m-%d %H:%M:%S")}
- **Total Cases**: {total_files}
- **Passed**: {pass_count}
- **Failed**: {fail_count}
- **Pass Rate**: {(pass_count/total_files)*100 if total_files > 0 else 0:.2f}%
- **Duration**: {duration:.2f} seconds

## Failed Cases Summary
{"\n".join(results) if results else "None"}
"""

with open("stress_report.md", "w") as f:
    f.write(report_content)

print(f"\nStress test complete. Pass rate: {(pass_count/total_files)*100 if total_files > 0 else 0:.2f}%")
print("Report saved to stress_report.md")
