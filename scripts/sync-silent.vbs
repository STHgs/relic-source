' =============================================================================
' scripts/sync-silent.vbs - silent wrapper + DSH-alive gate for relic-sync task
' =============================================================================
' Why this exists: install-schedule.mjs win32 branch used /TR cmd /c "npm run
'   sync". With InteractiveToken logon the task popped a visible cmd console
'   every 5 minutes (window title "npm sync").
' This wrapper does two things:
'   1. SILENT: wscript is a GUI-subsystem host; Shell.Run(..., 0) hides the
'      child console completely -> no popup at all.
'   2. DSH-ALIVE GATE (user decision 2026-09-21, plan A): when DSH is closed
'      there is no consumer for the sync output, so probe for a dsh process
'      (node.exe / cmd.exe command line containing @deepseek-ai\dsh or
'      @deepseek-ai/dsh); if absent, exit without running sync.
' Gate decisions append one line to %LOCALAPPDATA%\relic\sync-gate.log.
' DEPLOYMENT: install-schedule.mjs copies this file to
'   %LOCALAPPDATA%\relic\sync-silent.vbs, replacing __REPO__ with the local
'   engine clone path. The task /TR points at THAT copy, never at the repo,
'   so git pull never clobbers the live wrapper (repo copy stays portable).
' CONSTRAINT: keep this file PURE ASCII. wscript on CJK Windows may read a
'   UTF-8-without-BOM file as GBK and shift string boundaries -> parse chaos.
' NOTE: REPO below ("__REPO__") is replaced by install-schedule.mjs at install time.
' =============================================================================

Option Explicit

Dim REPO, shell, fso
REPO = "__REPO__"
Set shell = CreateObject("WScript.Shell")
Set fso = CreateObject("Scripting.FileSystemObject")

' --- 2. DSH-alive gate ---
Dim isDshRunning
isDshRunning = False

On Error Resume Next
Dim wmi, procs, proc
Set wmi = GetObject("winmgmts:\\.\root\cimv2")
If Err.Number = 0 Then
  Set procs = wmi.ExecQuery("SELECT CommandLine FROM Win32_Process WHERE Name = 'node.exe' OR Name = 'cmd.exe'")
  For Each proc In procs
    If Not IsNull(proc.CommandLine) Then
      If InStr(1, proc.CommandLine, "@deepseek-ai\dsh", vbTextCompare) > 0 _
         Or InStr(1, proc.CommandLine, "@deepseek-ai/dsh", vbTextCompare) > 0 Then
        isDshRunning = True
        Exit For
      End If
    End If
  Next
End If
On Error GoTo 0

' --- gate log (best effort; failures never block sync) ---
On Error Resume Next
Dim logDir, logFile, ts, actionStr
logDir = shell.ExpandEnvironmentStrings("%LOCALAPPDATA%") & "\relic"
If Not fso.FolderExists(logDir) Then
  fso.CreateFolder(logDir)
End If
actionStr = "skip"
If isDshRunning Then
  actionStr = "run"
End If
ts = Year(Now) & "-" & Right("0" & Month(Now), 2) & "-" & Right("0" & Day(Now), 2) _
  & " " & Right("0" & Hour(Now), 2) & ":" & Right("0" & Minute(Now), 2) & ":" & Right("0" & Second(Now), 2)
Set logFile = fso.OpenTextFile(logDir & "\sync-gate.log", 8, True)
logFile.WriteLine ts & " dshAlive=" & isDshRunning & " action=" & actionStr
logFile.Close
On Error GoTo 0

' --- 1. run sync silently ---
If isDshRunning Then
  shell.Run "cmd /c ""cd /d " & REPO & " && npm run sync""", 0, True
End If
