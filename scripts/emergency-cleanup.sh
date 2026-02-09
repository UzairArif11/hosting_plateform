#!/bin/bash
########################################
# Emergency Malware Cleanup Script
# Run this if crypto miners are detected
########################################

set -e

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

echo "========================================"
echo -e "${RED}EMERGENCY MALWARE CLEANUP${NC}"
echo "========================================"
echo ""

if [ "$EUID" -ne 0 ]; then 
    echo -e "${RED}ERROR: Please run as root (use sudo)${NC}"
    exit 1
fi

echo -e "${YELLOW}This will:${NC}"
echo "  1. Stop all suspicious services"
echo "  2. Remove malicious cron jobs"
echo "  3. Kill crypto miners"
echo "  4. Remove malicious containers"
echo "  5. Secure Docker API"
echo "  6. Enable firewall"
echo ""
read -p "Continue? (yes/no): " CONFIRM

if [ "$CONFIRM" != "yes" ]; then
    echo "Aborted."
    exit 0
fi

echo ""
echo -e "${GREEN}Step 1: Stopping suspicious systemd services...${NC}"
for service in cdngdn umx xmrig cacm; do
    if systemctl list-units --all | grep -q "$service"; then
        echo "  Stopping $service..."
        systemctl stop $service 2>/dev/null || true
        systemctl disable $service 2>/dev/null || true
        systemctl mask $service 2>/dev/null || true
    fi
done
find /etc/systemd /lib/systemd -name "*.service" -exec grep -l "cacm\|cdngdn\|umx\|xmrig" {} \; -delete 2>/dev/null || true
systemctl daemon-reload

echo ""
echo -e "${GREEN}Step 2: Removing malicious cron jobs...${NC}"
sed -i '/107.189/d' /etc/crontab 2>/dev/null || true
sed -i '/cacm/d' /etc/crontab 2>/dev/null || true
sed -i '/xmrig/d' /etc/crontab 2>/dev/null || true
find /etc/cron.d -name "zzh" -delete 2>/dev/null || true
find /etc/cron.d -type f -exec grep -l "107.189\|cacm\|xmrig" {} \; -delete 2>/dev/null || true

echo ""
echo -e "${GREEN}Step 3: Killing crypto miner processes...${NC}"
pkill -9 cacm 2>/dev/null || true
pkill -9 xmrig 2>/dev/null || true
pkill -9 miner 2>/dev/null || true
pkill -9 cdngdn 2>/dev/null || true
pkill -9 umx 2>/dev/null || true

echo ""
echo -e "${GREEN}Step 4: Removing malicious files...${NC}"
rm -rf /tmp/.cache 2>/dev/null || true
rm -rf /var/tmp/.cache 2>/dev/null || true
rm -rf /dev/shm/.cache 2>/dev/null || true
find /usr/local/bin /usr/bin /usr/sbin -name "*cacm*" -o -name "*xmrig*" -o -name "*cdngdn*" -delete 2>/dev/null || true

echo ""
echo -e "${GREEN}Step 5: Removing malicious Docker containers...${NC}"
docker stop $(docker ps -aq --filter "ancestor=alpine") 2>/dev/null || true
docker rm -f $(docker ps -aq --filter "ancestor=alpine") 2>/dev/null || true

echo ""
echo -e "${GREEN}Step 6: Blocking malicious IPs...${NC}"
iptables -A OUTPUT -d 107.189.3.150 -j DROP 2>/dev/null || true
iptables -A OUTPUT -d 107.189.0.0/16 -j DROP 2>/dev/null || true

echo ""
echo -e "${GREEN}Step 7: Securing Docker API...${NC}"
mkdir -p /etc/systemd/system/docker.service.d
cat > /etc/systemd/system/docker.service.d/override.conf <<EOF
[Service]
ExecStart=
ExecStart=/usr/bin/dockerd -H fd:// -H unix:///var/run/docker.sock
EOF
systemctl daemon-reload
systemctl restart docker

echo ""
echo -e "${GREEN}Step 8: Configuring firewall...${NC}"
apt install -y ufw 2>/dev/null || true
ufw --force reset
ufw default deny incoming
ufw default allow outgoing
ufw allow 22/tcp
ufw allow 80/tcp
ufw allow 443/tcp
ufw deny 2376
ufw --force enable

echo ""
echo -e "${GREEN}Step 9: Installing Fail2ban...${NC}"
apt install -y fail2ban 2>/dev/null || true
systemctl enable fail2ban
systemctl start fail2ban

echo ""
echo "========================================"
echo -e "${GREEN}Cleanup Complete!${NC}"
echo "========================================"
echo ""
echo "Verification:"
echo ""

# Check CPU
LOAD=$(uptime | awk -F'load average:' '{print $2}' | awk '{print $1}')
echo "  CPU Load: $LOAD (should be below 1.0)"

# Check Docker
if ss -tulpn | grep -q ":2376"; then
    echo -e "  Docker: ${RED}STILL EXPOSED on port 2376!${NC}"
else
    echo -e "  Docker: ${GREEN}Secured (not exposed)${NC}"
fi

# Check miners
MINERS=$(ps aux | grep -E "cacm|xmrig|miner" | grep -v grep | wc -l)
if [ "$MINERS" -eq 0 ]; then
    echo -e "  Miners: ${GREEN}None detected${NC}"
else
    echo -e "  Miners: ${RED}Still found $MINERS processes${NC}"
fi

echo ""
echo "Next steps:"
echo "1. Monitor CPU for next 10 minutes: watch uptime"
echo "2. Run security check: bash security-check.sh"
echo "3. Review auth logs: sudo grep 'Accepted\|Failed' /var/log/auth.log | tail -50"
echo ""
