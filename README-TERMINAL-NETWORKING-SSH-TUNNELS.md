# Terminal-Only Networking (No VCN Access): Enable EC1 -> EC2/EC3 Communication via Reverse SSH Tunnels

Goal
- From EC1 (Control Plane), reach the container agents on EC2 and EC3 over SSH-only, without editing Oracle Cloud VCN Security Lists.
- This allows EC1 to create/update/move containers on EC2/EC3 using HTTP calls through loopback ports on EC1 that are tunneled to EC2/EC3.

Approach
- Use persistent reverse SSH tunnels initiated from EC2/EC3 to EC1.
- EC1 will access each agent via localhost:PORT (e.g., 127.0.0.1:13001 for EC2, 127.0.0.1:13003 for EC3).
- Restrict all access via instance firewalls (UFW/iptables) so only SSH is exposed publicly; agent ports are NOT exposed to the internet.

What you’ll need
- EC1 public IP or DNS: {{EC1_PUBLIC_IP}}
- EC1 SSH user (e.g., ubuntu) that EC2/EC3 can log in to via key.
- EC2 and EC3 SSH access (you already have this via Terminus/SSH).

Important defaults (you can change ports if you like)
- EC2 agent local port: 3001  -> exposed on EC1 as 13001 (loopback only)
- EC2 shared container port (optional): 3002 -> exposed on EC1 as 13002 (loopback only)
- EC3 agent local port: 3001  -> exposed on EC1 as 13003 (loopback only)
- EC3 shared container port (optional): 3002 -> exposed on EC1 as 13004 (loopback only)

Security model
- Tunnels bind to 127.0.0.1 on EC1, so only apps on EC1 can reach them.
- UFW default deny inbound. Only SSH (22) is allowed.
- Agent ports (3001/3002) are not publicly open on EC2/EC3.

---

1) Prepare EC1 to accept reverse tunnels
Run on EC1
- Ensure SSH is running and you can SSH from EC2/EC3:
  - sudo ss -tulpn | grep ':22'
  - sudo ufw allow OpenSSH
- (Optional but recommended) Create a dedicated user for tunnels (example uses ubuntu; adapt if you create another user).
- Ensure loopback binding is allowed (default). We will bind to 127.0.0.1, which does not require changing GatewayPorts.

2) Generate SSH key on EC2 and authorize on EC1
Run on EC2
- Generate a key devoted to the tunnel:
  - ssh-keygen -t ed25519 -f ~/.ssh/id_ed25519_ec2_to_ec1 -N ""
- Copy the public key to EC1 (replace user and IP):
  - ssh-copy-id -i ~/.ssh/id_ed25519_ec2_to_ec1.pub ubuntu@{{EC1_PUBLIC_IP}}
  - If ssh-copy-id isn’t installed:
    - cat ~/.ssh/id_ed25519_ec2_to_ec1.pub | ssh ubuntu@{{EC1_PUBLIC_IP}} "mkdir -p ~/.ssh && chmod 700 ~/.ssh && cat >> ~/.ssh/authorized_keys && chmod 600 ~/.ssh/authorized_keys"

Repeat the same steps on EC3 (use a distinct key name like id_ed25519_ec3_to_ec1) if you will tunnel EC3 as well.

3) Install autossh on EC2 (and EC3)
Run on EC2 (and repeat on EC3)
- sudo apt update && sudo apt install -y autossh

4) Create a systemd service on EC2 for persistent reverse tunnels
Run on EC2
- sudo tee /etc/systemd/system/ec2-reverse-tunnel.service > /dev/null << 'EOF'
[Unit]
Description=EC2 -> EC1 Reverse SSH Tunnel (Agent + Shared Container)
After=network-online.target
Wants=network-online.target

[Service]
Type=simple
User=ubuntu
# Adjust the IdentityFile path and EC1 user@host as needed
ExecStart=/usr/bin/autossh -M 0 -N \
  -i /home/ubuntu/.ssh/id_ed25519_ec2_to_ec1 \
  -o "ServerAliveInterval 30" -o "ServerAliveCountMax 3" -o "ExitOnForwardFailure yes" \
  -R 127.0.0.1:13001:127.0.0.1:3001 \
  -R 127.0.0.1:13002:127.0.0.1:3002 \
  ubuntu@{{EC1_PUBLIC_IP}}
Restart=always
RestartSec=5

[Install]
WantedBy=multi-user.target
EOF

- sudo systemctl daemon-reload
- sudo systemctl enable ec2-reverse-tunnel
- sudo systemctl start ec2-reverse-tunnel
- sudo systemctl status ec2-reverse-tunnel --no-pager -l

5) Lock down EC2 with UFW (instance firewall)
Run on EC2
- sudo ufw default deny incoming
- sudo ufw default allow outgoing
- sudo ufw allow OpenSSH
- sudo ufw enable
- sudo ufw status verbose

Notes
- Do not add any allow rule for 3001/3002 on EC2; those ports are only accessed locally on EC2 and forwarded to EC1 over SSH.

6) Test from EC1
Run on EC1
- curl http://127.0.0.1:13001/health   # Should proxy to EC2 agent 3001
- (optional) curl http://127.0.0.1:13002/   # If your shared container exposes an HTTP endpoint

7) Configure backend on EC1 to use tunnels
Edit backend/.env on EC1 (examples; adapt to your variable names)
- For the orchestrator to reach EC2 agent via the tunnel, use loopback on EC1:
  - EC2_AGENT_URL=http://127.0.0.1:13001
  - EC2_SHARED_URL=http://127.0.0.1:13002   # only if you need it
- Restart backend to pick up changes:
  - cd backend && npm restart

8) Repeat for EC3
Run on EC3
- Generate key and install autossh as in steps 2 and 3 (use id_ed25519_ec3_to_ec1).
- Create service /etc/systemd/system/ec3-reverse-tunnel.service (ports 13003 and 13004):
  - sudo tee /etc/systemd/system/ec3-reverse-tunnel.service > /dev/null << 'EOF'
[Unit]
Description=EC3 -> EC1 Reverse SSH Tunnel (Agent + Shared Container)
After=network-online.target
Wants=network-online.target

[Service]
Type=simple
User=ubuntu
ExecStart=/usr/bin/autossh -M 0 -N \
  -i /home/ubuntu/.ssh/id_ed25519_ec3_to_ec1 \
  -o "ServerAliveInterval 30" -o "ServerAliveCountMax 3" -o "ExitOnForwardFailure yes" \
  -R 127.0.0.1:13003:127.0.0.1:3001 \
  -R 127.0.0.1:13004:127.0.0.1:3002 \
  ubuntu@{{EC1_PUBLIC_IP}}
Restart=always
RestartSec=5

[Install]
WantedBy=multi-user.target
EOF

- sudo systemctl daemon-reload
- sudo systemctl enable ec3-reverse-tunnel
- sudo systemctl start ec3-reverse-tunnel
- sudo systemctl status ec3-reverse-tunnel --no-pager -l

Update backend/.env on EC1
- EC3_AGENT_URL=http://127.0.0.1:13003
- EC3_SHARED_URL=http://127.0.0.1:13004   # only if you need it
- Restart backend.

9) Hardening and best practices
- UFW on EC1: allow 5000/tcp (API) and OpenSSH; deny everything else inbound. Do NOT open 13001-13004 to the public (they are loopback-bound anyway).
- Ensure agent on EC2/EC3 listens on 127.0.0.1:3001 (or restrict via firewall) if you want extra safety:
  - Use UFW to deny 3001/3002 from anywhere but localhost, or bind your agent to localhost.
- Keys: keep the dedicated tunnel keys separate and least-privileged. Consider a dedicated user on EC1 with a limited shell.
- Autoreconnect: autossh restarts tunnels if the connection drops.

10) Troubleshooting
On EC2/EC3
- journalctl -u ec2-reverse-tunnel -f  (or ec3-reverse-tunnel)
- ss -tulpn | grep ':3001\|:3002'   # agent/listener status

On EC1
- ss -tln | grep ':13001\|:13002\|:13003\|:13004'  # tunnel listeners
- curl http://127.0.0.1:13001/health  # EC2 agent health
- curl http://127.0.0.1:13003/health  # EC3 agent health

If tunnels don’t appear on EC1
- Verify SSH from EC2 -> EC1 works with the chosen key:
  - ssh -i ~/.ssh/id_ed25519_ec2_to_ec1 ubuntu@{{EC1_PUBLIC_IP}}
- Check that port 22 is reachable from EC2 to EC1 (UFW/iptables on EC1 and any cloud firewall).
- Ensure autossh is installed and systemd service is running.

Cleanup / changes
- Stop tunnel service: sudo systemctl stop ec2-reverse-tunnel
- Disable on boot: sudo systemctl disable ec2-reverse-tunnel
- Remove service: sudo rm /etc/systemd/system/ec2-reverse-tunnel.service && sudo systemctl daemon-reload

---

By using reverse SSH tunnels, you can operate entirely from SSH without touching Oracle VCN Security Lists. EC1 will see EC2/EC3 agents as local endpoints on 127.0.0.1, and your orchestrator can call them normally.

