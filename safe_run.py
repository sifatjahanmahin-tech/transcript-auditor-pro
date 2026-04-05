import sys
import subprocess
import traceback

try:
    process = subprocess.Popen(
        [sys.executable, 'audit_tool.py', 'stress_test_data/student_0.csv', 'Electrical & Computer Engineering', 'program.md', '--no-interactive'],
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE,
        text=True,
        encoding='utf-8',
        errors='replace'
    )
    stdout, stderr = process.communicate(timeout=10)
    print("STDOUT:", stdout)
    print("STDERR:", stderr)
    print("RETURN CODE:", process.returncode)
except Exception as e:
    print("Exception running process:")
    traceback.print_exc()
