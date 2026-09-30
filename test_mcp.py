import subprocess
import json
import time

def test_mcp(name, command, args):
    print(f"Testing MCP Server: {name}")
    try:
        # Start the MCP server process
        process = subprocess.Popen(
            [command] + args,
            stdin=subprocess.PIPE,
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
            text=True
        )
        
        # Give it a second to start
        time.sleep(2)
        
        # Send JSON-RPC initialize request
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
        
        # Read response
        response_str = process.stdout.readline()
        
        if response_str:
            response = json.loads(response_str)
            if "result" in response:
                print(f"[SUCCESS] {name} responded with capabilities: {list(response['result'].get('capabilities', {}).keys())}")
            else:
                print(f"[FAILED] {name} unexpected response: {response}")
        else:
            print(f"[FAILED] {name} did not respond.")
            
        process.terminate()
    except Exception as e:
        print(f"[ERROR] {name}: {e}")

if __name__ == "__main__":
    npx_cmd = "npx.cmd"
    test_mcp("Puppeteer", npx_cmd, ["-y", "@modelcontextprotocol/server-puppeteer"])
    test_mcp("Filesystem", npx_cmd, ["-y", "@modelcontextprotocol/server-filesystem", "C:\\", "d:\\work\\platform"])
    test_mcp("GitHub", npx_cmd, ["-y", "@modelcontextprotocol/server-github"])
