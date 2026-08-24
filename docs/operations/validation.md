# Validation

## Automated Verification
- **OpenXML Schema & Package Roundtrip Integrity**:
  ```powershell
  dotnet run --project spike/OpenXmlSpike
  ```
- **Automated Test Suite**:
  ```powershell
  dotnet test
  ```

## Agent Ground Freshness & Rules
- **Check Ground Status**:
  ```powershell
  python "$env:USERPROFILE\.gemini\config\plugins\agent-ground\scripts\agent_ground.py" status .
  ```
- **Verify Architecture Context**:
  ```powershell
  python "$env:USERPROFILE\.gemini\config\plugins\agent-ground\scripts\agent_ground.py" verify . --yes
  ```

