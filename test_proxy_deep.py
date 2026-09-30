import httpx
import asyncio
import json

async def test_tool_calling():
    print("Deep Test: Testing Proxy Tool Calling with Gemini...")
    try:
        async with httpx.AsyncClient(timeout=30.0) as client:
            response = await client.post(
                "http://localhost:8081/v1/chat/completions",
                headers={"Authorization": "Bearer test-key", "Content-Type": "application/json"},
                json={
                    "model": "gemini-3.6-flash",
                    "messages": [{"role": "user", "content": "Fetch the internal server status for the 'auth_service' cluster."}],
                    "tools": [{
                        "type": "function",
                        "function": {
                            "name": "get_internal_server_status",
                            "description": "Fetch the private server status for a given cluster",
                            "parameters": {
                                "type": "object", 
                                "properties": {"cluster": {"type": "string"}}, 
                                "required": ["cluster"]
                            }
                        }
                    }]
                }
            )
            
            if response.status_code == 200:
                data = response.json()
                message = data['choices'][0]['message']
                if 'tool_calls' in message and len(message['tool_calls']) > 0:
                    tool_call = message['tool_calls'][0]
                    print(f"[SUCCESS] Model correctly decided to call tool: {tool_call['function']['name']}")
                    print(f"[SUCCESS] Tool arguments: {tool_call['function']['arguments']}")
                else:
                    print(f"[FAILED] Model did not call the tool. Response: {message['content']}")
            else:
                print(f"[FAILED] HTTP {response.status_code} - {response.text}")
    except Exception as e:
        print(f"[ERROR] Exception during test: {str(e)}")

if __name__ == "__main__":
    asyncio.run(test_tool_calling())
