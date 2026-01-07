#!/bin/bash

###############################################################################
# COMPLETE CLEANUP - Nuclear Option
# 
# Alternative to cleanup-server.sh (more aggressive)
# Removes EVERYTHING including user containers (if you confirm)
###############################################################################

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
BOLD='\033[1m'
NC='\033[0m'

clear
echo -e "${RED}${BOLD}"
cat << "EOF"
╔════════════════════════════════════════════════════════════╗
║         ⚠️  NUCLEAR CLEANUP - EVERYTHING ⚠️                 ║
║                                                            ║
║  This is more aggressive than cleanup-server.sh            ║
║  Use this when you want to completely reset                ║
╚════════════════════════════════════════════════════════════╝
EOF
echo -e "${NC}"

echo -e "${YELLOW}This will cleanup EVERYTHING. Continue? (yes/no)${NC}"
read -r confirm
if [ "$confirm" != "yes" ]; then
    exit 0
fi

echo -e "\n${CYAN}Starting nuclear cleanup...${NC}"

# PM2
echo "→ Killing PM2..."
pm2 kill 2>/dev/null || true
rm -rf ~/.pm2 2>/dev/null || true
echo "✓ PM2 removed"

# Processes
echo "→ Killing all Next.js and Node processes..."
sudo pkill -f "next-server" 2>/dev/null || true
sudo pkill -f "next start" 2>/dev/null || true
sudo pkill -f "node.*frontend" 2>/dev/null || true
echo "✓ Processes killed"

# Docker - Platform containers
echo "→ Removing platform containers..."
docker stop vercel-clone-mongodb vercel-clone-redis vercel-clone-mongo-express 2>/dev/null || true
docker rm vercel-clone-mongodb vercel-clone-redis vercel-clone-mongo-express 2>/dev/null || true
echo "✓ Platform containers removed"

# Docker - User containers
USER_COUNT=$(docker ps -a --filter "name=EC3-user-" | wc -l)
if [ "$USER_COUNT" -gt 1 ]; then
    echo ""
    echo -e "${YELLOW}Found $((USER_COUNT - 1)) user containers${NC}"
    echo -e "${RED}Remove user containers too? (yes/no)${NC}"
    read -r remove_users
    if [ "$remove_users" = "yes" ]; then
        docker ps -a --filter "name=EC3-user-" --format "{{.Names}}" | xargs docker rm -f 2>/dev/null || true
        echo "✓ User containers removed"
    else
        echo "✓ User containers preserved"
    fi
fi

# Docker volumes
echo ""
echo -e "${RED}Remove Docker volumes (deletes all data)? (yes/no)${NC}"
read -r remove_volumes
if [ "$remove_volumes" = "yes" ]; then
    docker volume rm hosting_plateform_mongodb_data hosting_plateform_mongodb_config hosting_plateform_redis_data 2>/dev/null || true
    echo "✓ Volumes removed"
else
    echo "✓ Volumes preserved"
fi

# Logs and files
echo "→ Cleaning files..."
rm -rf logs 2>/dev/null || true
rm -f .deployed 2>/dev/null || true
echo "✓ Files cleaned"

echo ""
echo -e "${GREEN}${BOLD}✅ Nuclear cleanup complete!${NC}"
echo ""
echo "System is now clean. Ready for fresh deployment."
echo ""
echo "Run: ./cleanup-server.sh && ./setup-deployment-server.sh && sudo ./fix-ssl-now.sh"
echo "Or:  ./deploy.sh"
