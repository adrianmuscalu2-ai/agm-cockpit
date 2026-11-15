function Set-AgmatccOpenAiCredentialFromWindowsCredentialManager {
  $source = @'
using System;
using System.Runtime.InteropServices;
using System.Text;
public static class AgmCredentialManagerReader {
  [StructLayout(LayoutKind.Sequential, CharSet = CharSet.Unicode)]
  private struct Credential {
    public uint Flags; public uint Type; public IntPtr TargetName; public IntPtr Comment;
    public System.Runtime.InteropServices.ComTypes.FILETIME LastWritten;
    public uint CredentialBlobSize; public IntPtr CredentialBlob; public uint Persist;
    public uint AttributeCount; public IntPtr Attributes; public IntPtr TargetAlias; public IntPtr UserName;
  }
  [DllImport("Advapi32.dll", EntryPoint = "CredReadW", CharSet = CharSet.Unicode, SetLastError = true)]
  private static extern bool CredRead(string target, uint type, uint flags, out IntPtr credential);
  [DllImport("Advapi32.dll", SetLastError = false)]
  private static extern void CredFree(IntPtr credential);
  public static int ReadApiKeyIntoProcessEnvironment(string target, string envName) {
    IntPtr credentialPointer;
    if (!CredRead(target, 1, 0, out credentialPointer)) return -Marshal.GetLastWin32Error();
    byte[] bytes = null;
    try {
      Credential credential = Marshal.PtrToStructure<Credential>(credentialPointer);
      if (credential.CredentialBlob == IntPtr.Zero || credential.CredentialBlobSize < 20 || credential.CredentialBlobSize > 65536) return -1001;
      bytes = new byte[credential.CredentialBlobSize];
      Marshal.Copy(credential.CredentialBlob, bytes, 0, bytes.Length);
      string secret = bytes.Length > 1 && bytes[1] == 0 ? Encoding.Unicode.GetString(bytes) : Encoding.UTF8.GetString(bytes);
      secret = secret.TrimEnd('\0', '\r', '\n');
      if (!secret.StartsWith("sk-", StringComparison.Ordinal) || secret.Length < 20 || secret.Contains("\0")) return -1002;
      Environment.SetEnvironmentVariable(envName, secret, EnvironmentVariableTarget.Process);
      secret = null;
      return 1;
    } finally {
      if (bytes != null) Array.Clear(bytes, 0, bytes.Length);
      CredFree(credentialPointer);
    }
  }
}
'@
  $null = Add-Type -TypeDefinition $source -Language CSharp -PassThru
  $result = [AgmCredentialManagerReader]::ReadApiKeyIntoProcessEnvironment('AGMaTCC-Luna-Test-20261115', 'OPENAI_API_KEY')
  if ($result -ne 1) { throw "WINDOWS_CREDENTIAL_READ_FAILED:$(-$result)" }
  return $true
}
