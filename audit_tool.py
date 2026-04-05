#!/usr/bin/env python3
"""
Transcript Auditor Pro — CLI Tool
---------------------------------
The next-generation NSU degree auditor. Now with:
  - Google OAuth2 Single Sign-On
  - OCR Scan Support (Remote)
  - Persistent History
  - Premium Terminal UI (Rich)

Usage:
    Local:   python audit_tool.py --local <transcript.csv> <program_name> <program.md>
    Cloud:   python audit_tool.py upload <file> [--program-id <id>]
    History: python audit_tool.py history
    Auth:    python audit_tool.py login | logout
"""

import os
import sys
import argparse
from typing import Dict, Any, List

# Ensure project root is on the import path
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from cli.client import AuditProClient
from rich.console import Console
from rich.table import Table
from rich.panel import Panel
from rich.progress import Progress, SpinnerColumn, TextColumn
from rich import print as rprint

console = Console()
client = AuditProClient()

def print_banner():
    console.print(Panel.fit(
        "[bold cyan]TRANSCRIPT AUDITOR PRO[/bold cyan] [white]v1.0.0[/white]\n"
        "[dim]Official Degree Audit Suite for NSU Students[/dim]",
        border_style="cyan",
        padding=(1, 4)
    ))

def display_audit_result(data: Dict[str, Any]):
    """Print audit summary using Rich tables."""
    # 1. Credit Summary
    rprint("\n[bold h1]Degree Audit Summary[/bold h1]")
    
    stats_table = Table(box=None)
    stats_table.add_column("Metric", style="cyan")
    stats_table.add_column("Value", style="bold white")
    
    stats_table.add_row("Total Credits", f"{data['total_valid_credits']:.1f}")
    stats_table.add_row("Cumulative GPA", f"{data['cgpa']:.3f}")
    stats_table.add_row("Status", "[bold green]PASS[/bold green]" if not data.get("on_probation", False) else "[bold red]PROBATION[/bold red]")
    
    console.print(Panel(stats_table, title="Level 1 & 2: Overview", border_style="blue"))

    # 2. Completed Courses
    comp_table = Table(title="Completed Courses", title_style="bold green", show_header=True, header_style="bold")
    comp_table.add_column("Course Code", width=12)
    comp_table.add_column("Course Name")
    comp_table.add_column("Grade", justify="center")
    comp_table.add_column("Credits", justify="center")

    for course in data.get("credit_breakdown", []):
        if "Completed" in course.get("status", ""):
            comp_table.add_row(
                course.get("course_code", ""),
                course.get("course_name", "")[:40],
                course.get("grade", "-"),
                str(course.get("credits", "0"))
            )
    
    console.print(comp_table)

    # 3. Missing Courses
    missing = data.get("missing_courses", {})
    if missing:
        rprint("\n[bold red]Level 3: Deficiencies (Missing Courses)[/bold red]")
        for category, codes in missing.items():
            if codes:
                console.print(f"  [bold yellow]{category}:[/bold yellow] {', '.join(codes)}")
    else:
        rprint("\n[bold green]✓ All program requirements satisfied![/bold green]")

def handle_login():
    if client.authenticate():
        rprint("\n[bold green]Login Success![/bold green] You can now perform remote audits and view history.")
    else:
        rprint("\n[bold red]Login Failed.[/bold red] Please try again.")

def handle_upload(args):
    """Handle remote file upload and audit execution."""
    if not client.access_token:
        rprint("[bold yellow]Attention:[/bold yellow] This requires cloud sync. Running auth flow...")
        if not client.authenticate():
            return

    # Check for programs
    programs = client.list_programs()
    if not programs:
        rprint("[bold red]Error:[/bold red] No programs found on server. Seed the database first.")
        return

    # Default to first program if not specified
    program_id = args.program_id
    if not program_id:
        rprint("\n[bold]Select Program:[/bold]")
        for i, p in enumerate(programs, 1):
            rprint(f" {i}. [cyan]{p['name']}[/cyan] ({p['id']})")
        
        choice = input("\nEnter program number [1]: ").strip() or "1"
        try:
            idx = int(choice) - 1
            program_id = programs[idx]['id']
        except (ValueError, IndexError):
            rprint("[bold red]Invalid choice.[/bold red]")
            return

    with Progress(
        SpinnerColumn(),
        TextColumn("[progress.description]{task.description}"),
        transient=True,
    ) as progress:
        progress.add_task(description="Processing transcript (Remote OCR)...", total=None)
        result = client.run_remote_audit(args.file, program_id)
        
    if result:
        display_audit_result(result)

def handle_history():
    """Fetch and list history."""
    if not client.access_token:
        rprint("[bold red]Error:[/bold red] Not logged in. Use 'python audit_tool.py login'.")
        return

    history = client.get_history()
    if not history:
        rprint("[yellow]No audit history found for this account.[/yellow]")
        return

    table = Table(title="Recent Audit History", header_style="bold cyan")
    table.add_column("Date", style="dim")
    table.add_column("Program", style="cyan")
    table.add_column("File", style="italic")
    table.add_column("Credits", justify="center")
    table.add_column("GPA", justify="center")

    for h in history:
        date_str = h['created_at'].split('T')[0]
        table.add_row(
            date_str,
            h['program_id'][:8] + "...", # Simplified
            h['filename'],
            f"{h['total_credits']:.0f}",
            f"{h['cgpa']:.3f}"
        )
    
    console.print(table)

def main():
    parser = argparse.ArgumentParser(description="Audit Pro CLI")
    subparsers = parser.add_subparsers(dest="command", help="Available commands")

    # Cloud Login
    subparsers.add_parser("login", help="Authenticate with Google")
    subparsers.add_parser("logout", help="Clear local session")

    # Remote Audit
    upload_parser = subparsers.add_parser("upload", help="Upload file for remote audit")
    upload_parser.add_argument("file", help="Path to CSV or Image file")
    upload_parser.add_argument("--program-id", help="Target program ID")

    # History
    subparsers.add_parser("history", help="View remote audit history")

    # Local Mode (Backward Compatibility)
    local_parser = subparsers.add_parser("local", help="Run audit locally (no sync)")
    local_parser.add_argument("transcript", help="Path to local CSV")
    local_parser.add_argument("program_name", help="Program Title")
    local_parser.add_argument("requirements", help="Path to program.md")

    args = parser.parse_args()

    print_banner()

    if args.command == "login":
        handle_login()
    elif args.command == "logout":
        client.logout()
        rprint("[yellow]Logged out successfully.[/yellow]")
    elif args.command == "upload":
        handle_upload(args)
    elif args.command == "history":
        handle_history()
    elif args.command == "local":
        # Import local logic only when needed
        from parsers.transcript_parser import parse_transcript
        from parsers.program_parser import parse_program
        from engine.audit_engine import run_audit
        
        rprint(f"  [bold yellow]LOCAL MODE:[/bold yellow] Parsing {args.transcript}")
        entries = parse_transcript(args.transcript)
        program = parse_program(args.requirements, args.program_name)
        result = run_audit(entries, program, set())
        
        # Format as Dict for display
        display_audit_result(result.__dict__)
    else:
        parser.print_help()

if __name__ == "__main__":
    main()
