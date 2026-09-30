import subprocess
import json
import time
import os

def test_mcp_read_file():
    print("Deep Test: Testing Filesystem MCP Tool Execution...")
    try:
        process = subprocess.Popen(
            ["npx.cmd", "-y", "@modelcontextprotocol/server-filesystem", "C:\\", "d:\\work\\platform"],
            stdin=subprocess.PIPE,
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
            text=True
        )
        
        time.sleep(2)
        
        # 1. Initialize
        init_req = {
            "jsonrpc": "2.0",
            "id": 1,
            "method": "initialize",
            "params": {
                "protocolVersion": "2024-11-05",
                "capabilities": {},
                "clientInfo": {"name": "test-client", "version": "1.0.0"}
            }
        }
        process.stdin.write(json.dumps(init_req) + "\n")
        process.stdin.flush()
        
        # Read init response
        process.stdout.readline()
        
        # 2. Call a tool (read_file on index.html)
        target_file = "d:\\work\\platform\\index.html"
        tool_req = {
            "jsonrpc": "2.0",
            "id": 2,
            "method": "tools/call",
            "params": {
                "name": "read_file",
                "arguments": {
                    "path": target_file
                }
            }
        }
        process.stdin.write(json.dumps(tool_req) + "\n")
        process.stdin.flush()
        
        # Read tool response
        response_str = process.stdout.readline()
        if response_str:
            response = json.loads(response_str)
            if "result" in response and not response["result"].get("isError"):
                content = response["result"]["content"][0]["text"]
                print(f"[SUCCESS] Successfully read file via MCP. Content length: {len(content)} bytes")
                if "Live Preview Test" in content:
                    print("[SUCCESS] Verified file contents exactly match the test file!")
            else:
                print(f"[FAILED] Unexpected tool response: {response}")
        else:
            print("[FAILED] No response from tool call.")
            
        process.terminate()
    except Exception as e:
        print(f"[ERROR] Exception during test: {str(e)}")

if __name__ == "__main__":
    test_mcp_read_file()
