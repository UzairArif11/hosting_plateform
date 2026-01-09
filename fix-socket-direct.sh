#!/bin/bash
# DIRECT FIX: Socket.IO WebSocket - Simple and Reliable

set -e
CONFIG_FILE="/etc/nginx/sites-available/default"

if [ ! -f "$CONFIG_FILE" ]; then
    echo "Config file not found: $CONFIG_FILE"
    exit 1
fi

echo "Fixing Socket.IO in: $CONFIG_FILE"
sudo cp "$CONFIG_FILE" "${CONFIG_FILE}.backup.$(date +%Y%m%d_%H%M%S)"

# Remove old Socket.IO blocks
sudo sed -i '/location \/api\/socket\.io\/ {/,/^[[:space:]]*}/d' "$CONFIG_FILE"

# Add Socket.IO before location /api/ in HTTPS block
sudo python3 << 'PYEOF'
import re

with open('$CONFIG_FILE', 'r') as f:
    lines = f.readlines()

new_lines = []
in_https = False
socket_added = False

for i, line in enumerate(lines):
    if 'listen 443 ssl' in line:
        in_https = True
        socket_added = False
    
    if in_https and line.strip().startswith('location /api/ {') and 'socket' not in line:
        if not socket_added:
            indent = ' ' * (len(line) - len(line.lstrip()))
            new_lines.append(f'{indent}# Socket.IO WebSocket Support\n')
            new_lines.append(f'{indent}location /api/socket.io/ {{\n')
            new_lines.append(f'{indent}    proxy_pass http://127.0.0.1:5000;\n')
            new_lines.append(f'{indent}    proxy_http_version 1.1;\n')
            new_lines.append(f'{indent}    proxy_set_header Upgrade $http_upgrade;\n')
            new_lines.append(f'{indent}    proxy_set_header Connection "upgrade";\n')
            new_lines.append(f'{indent}    proxy_set_header Host $host;\n')
            new_lines.append(f'{indent}    proxy_set_header X-Real-IP $remote_addr;\n')
            new_lines.append(f'{indent}    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;\n')
            new_lines.append(f'{indent}    proxy_set_header X-Forwarded-Proto $scheme;\n')
            new_lines.append(f'{indent}    proxy_cache_bypass $http_upgrade;\n')
            new_lines.append(f'{indent}    proxy_read_timeout 86400;\n')
            new_lines.append(f'{indent}}}\n')
            new_lines.append('\n')
            socket_added = True
    
    new_lines.append(line)
    
    if in_https and line.strip() == '}':
        in_https = False

with open('/tmp/nginx-fixed.conf', 'w') as f:
    f.writelines(new_lines)
print("Done")
PYEOF

sudo mv /tmp/nginx-fixed.conf "$CONFIG_FILE"
sudo nginx -t && sudo systemctl reload nginx
echo "✅ Socket.IO fixed!"
