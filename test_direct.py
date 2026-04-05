import sys
from audit_tool import main
import traceback

sys.argv = ['audit_tool.py', 'stress_test_data/student_0.csv', 'Electrical & Computer Engineering', 'program.md', '--no-interactive']
print("Testing student_0.csv directly via import...")
try:
    main()
except Exception as e:
    traceback.print_exc()
