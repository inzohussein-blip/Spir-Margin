' Spir-Margin - start the server with no window.
'
'   wscript.exe run-hidden.vbs [port] [host]
'
' A console window at every sign-in is one that someone closes, and closing
' it would stop the program. This runs run-server.cmd hidden instead.
Option Explicit
Dim fso, sh, here, args, i
Set fso = CreateObject("Scripting.FileSystemObject")
Set sh = CreateObject("WScript.Shell")
here = fso.GetParentFolderName(WScript.ScriptFullName)

args = ""
For i = 0 To WScript.Arguments.Count - 1
  args = args & " """ & WScript.Arguments(i) & """"
Next

' cmd /c ""C:\path with spaces\run-server.cmd" "3000" "127.0.0.1""
sh.Run "cmd.exe /c """"" & here & "\run-server.cmd""" & args & """", 0, False
