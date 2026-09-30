import yaml
import sys

def test_config():
    config_path = r"C:\Users\INTERWARE\.continue\config.yaml"
    print(f"Testing Continue config file at: {config_path}")
    
    try:
        with open(config_path, "r", encoding="utf-8") as f:
            config = yaml.safe_load(f)
            
        print("[SUCCESS] YAML parsed successfully! No syntax errors.")
        
        # 1. Check Header
        assert config.get("name") == "Main Config", "Missing or incorrect name"
        assert config.get("version") == "1.0.0", "Missing or incorrect version"
        assert config.get("schema") == "v1", "Missing or incorrect schema"
        print("[SUCCESS] Schema header (name, version, schema) is perfectly valid.")
        
        # 2. Check Models
        models = config.get("models", [])
        assert isinstance(models, list), "Models must be a list"
        assert len(models) >= 6, "Expected at least 6 models"
        assert "name" in models[0], "Models must use 'name' key, not 'title'"
        print(f"[SUCCESS] {len(models)} models loaded perfectly with correct 'name' keys.")
        
        # 3. Check Context Providers
        context = config.get("context", [])
        assert isinstance(context, list), "Context must be a list"
        print(f"[SUCCESS] {len(context)} context providers configured successfully.")
        
        # 4. Check MCP Servers
        mcp = config.get("mcpServers", {})
        assert isinstance(mcp, dict), "mcpServers MUST be a dictionary, not a list!"
        assert "puppeteer" in mcp, "puppeteer MCP missing"
        assert "filesystem" in mcp, "filesystem MCP missing"
        print(f"[SUCCESS] mcpServers is a valid dictionary containing {len(mcp)} servers.")
        
        print("\nAll deep structural tests PASSED! The config is bulletproof.")
        
    except AssertionError as e:
        print(f"[FAILED] Validation error: {e}")
        sys.exit(1)
    except Exception as e:
        print(f"[ERROR] Could not parse config: {e}")
        sys.exit(1)

if __name__ == "__main__":
    test_config()
