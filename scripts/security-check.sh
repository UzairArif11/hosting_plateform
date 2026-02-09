#!/bin/bash
########################################
# Security Check Script
# Run this daily to verify server security
########################################

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

ISSUES=0

echo "========================================"
echo "Server Security Check"
echo "========================================"
echo ""

# 1. Check if Docker API is exposed
echo -n "Checking Docker API exposure... "
if sudo ss -tulpn | grep -q ":2376"; then
    echo -e "${RED}FAIL - Port 2376 is EXPOSED!${NC}"
    ISSUES=$((ISSUES + 1))
    sudo ss -tulpn | grep 2376
else
    echo -e "${GREEN}PASS${NC}"
fi

# 2. Check firewall status
echo -n "Checking firewall status... "
if sudo ufw status | grep -q "Status: active"; then
    echo -e "${GREEN}PASS${NC}"
else
    echo -e "${RED}FAIL - Firewall is inactive${NC}"
    ISSUES=$((ISSUES + 1))
fi

# 3. Check for suspicious cron jobs
echo -n "Checking for malicious cron jobs... "
SUSPICIOUS=$(sudo grep -r "107.189" /etc/cron* 2>/dev/null | wc -l)
if [ "$SUSPICIOUS" -eq 0 ]; then
    echo -e "${GREEN}PASS${NC}"
else
    echo -e "${RED}FAIL - Found $SUSPICIOUS suspicious entries${NC}"
    ISSUES=$((ISSUES + 1))
    sudo grep -r "107.189" /etc/cron*
fi

# 4. Check for crypto miners
echo -n "Checking for crypto miners... "
MINERS=$(ps aux | grep -E "cacm|xmrig|miner|cdngdn" | grep -v grep | wc -l)
if [ "$MINERS" -eq 0 ]; then
    echo -e "${GREEN}PASS${NC}"
else
    echo -e "${RED}FAIL - Found $MINERS suspicious processes${NC}"
    ISSUES=$((ISSUES + 1))
    ps aux | grep -E "cacm|xmrig|miner|cdngdn" | grep -v grep
fi

# 5. Check CPU usage
echo -n "Checking CPU usage... "
LOAD=$(uptime | awk -F'load average:' '{print $2}' | awk '{print $1}' | cut -d. -f1)
if [ "$LOAD" -lt 3 ]; then
    echo -e "${GREEN}PASS (Load: $LOAD)${NC}"
else
    echo -e "${YELLOW}WARNING - High load: $LOAD${NC}"
    echo "Top CPU processes:"
    ps aux --sort=-%cpu | head -10
fi

# 6. Check for suspicious systemd services
echo -n "Checking systemd services... "
SUSPICIOUS_SERVICES=$(systemctl list-units --type=service --all | grep -E "cacm|cdngdn|umx|xmrig" | wc -l)
if [ "$SUSPICIOUS_SERVICES" -eq 0 ]; then
    echo -e "${GREEN}PASS${NC}"
else
    echo -e "${RED}FAIL - Found $SUSPICIOUS_SERVICES suspicious services${NC}"
    ISSUES=$((ISSUES + 1))
    systemctl list-units --type=service --all | grep -E "cacm|cdngdn|umx|xmrig"
fi

# 7. Check Fail2ban status
echo -n "Checking Fail2ban... "
if systemctl is-active --quiet fail2ban; then
    echo -e "${GREEN}PASS${NC}"
else
    echo -e "${YELLOW}WARNING - Fail2ban is not running${NC}"
fi

# 8. Check for unauthorized Docker containers
echo -n "Checking Docker containers... "
ALPINE_COUNT=$(docker ps -a --filter "ancestor=alpine" --format "{{.ID}}" | wc -l)
if [ "$ALPINE_COUNT" -eq 0 ]; then
    echo -e "${GREEN}PASS${NC}"
else
    echo -e "${YELLOW}WARNING - Found $ALPINE_COUNT Alpine containers${NC}"
    docker ps -a --filter "ancestor=alpine"
fi

echo ""
echo "========================================"
if [ "$ISSUES" -eq 0 ]; then
    echo -e "${GREEN}✓ All security checks passed!${NC}"
    exit 0
else
    echo -e "${RED}✗ Found $ISSUES security issues!${NC}"
    echo ""
    echo "Recommended actions:"
    echo "1. Run: sudo bash /path/to/emergency-cleanup.sh"
    echo "2. Review logs: sudo journalctl -xe"
    echo "3. Check authorized_keys: cat ~/.ssh/authorized_keys"
    exit 1
fi
