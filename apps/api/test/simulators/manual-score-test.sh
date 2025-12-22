#!/bin/bash

# Manual Score Submission Test Script
# This simulates multiple users submitting scores to test realtime updates

API_URL="http://localhost:3000"
MODE="GP"
SEASON="99"
GAME="1"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}🏁 F-ZERO 99 Realtime Score Submission Test${NC}"
echo "==========================================="
echo ""

# Function to submit a score
submit_score() {
    local position=$1
    local points=$2
    local machine=$3
    local assist=$4
    local delay=$5
    local user_num=$6

    echo -e "${YELLOW}Player ${user_num}:${NC} Submitting score..."

    # Create a test JWT token (this would need to be real in production)
    # For testing, you might need to modify this based on your auth setup
    TOKEN="test-token-${user_num}"

    # Submit score using curl
    RESPONSE=$(curl -s -X POST "${API_URL}/api/matches/${MODE}/${SEASON}/${GAME}/score" \
        -H "Content-Type: application/json" \
        -H "Authorization: Bearer ${TOKEN}" \
        -d "{
            \"position\": ${position},
            \"reportedPoints\": ${points},
            \"machine\": \"${machine}\",
            \"assistEnabled\": ${assist}
        }" 2>/dev/null)

    if [[ $? -eq 0 ]]; then
        echo -e "  ${GREEN}✅${NC} #${position} | ${points}pts | ${machine} | Assist: ${assist}"
    else
        echo -e "  ${RED}❌${NC} Failed to submit"
    fi

    # Wait before next submission
    if [[ $delay -gt 0 ]]; then
        echo -e "  ⏱️  Waiting ${delay} seconds..."
        sleep $delay
    fi
}

# Test Mode Selection
echo "Select test mode:"
echo "1) Gradual (10 players, 3 sec delay)"
echo "2) Fast (20 players, 1 sec delay)"
echo "3) Burst (10 players, no delay)"
echo "4) Custom"
echo ""
read -p "Enter choice [1-4]: " choice

case $choice in
    1)
        echo -e "\n${GREEN}Starting GRADUAL test...${NC}\n"
        submit_score 1 1000 "Blue Falcon" false 3 1
        submit_score 2 950 "Golden Fox" false 3 2
        submit_score 3 900 "Fire Stingray" false 3 3
        submit_score 4 850 "Wild Goose" false 3 4
        submit_score 5 800 "Blue Falcon" true 3 5
        submit_score 6 750 "Golden Fox" false 3 6
        submit_score 7 700 "Fire Stingray" false 3 7
        submit_score 8 650 "Wild Goose" true 3 8
        submit_score 9 600 "Blue Falcon" false 3 9
        submit_score 10 550 "Golden Fox" true 0 10
        ;;
    2)
        echo -e "\n${GREEN}Starting FAST test...${NC}\n"
        for i in {1..20}; do
            points=$((1000 - i * 40))
            machines=("Blue Falcon" "Golden Fox" "Wild Goose" "Fire Stingray")
            machine=${machines[$((RANDOM % 4))]}
            assist="false"
            if [[ $i -gt 10 ]]; then
                assist="true"
            fi
            submit_score $i $points "$machine" $assist 1 $i
        done
        ;;
    3)
        echo -e "\n${GREEN}Starting BURST test...${NC}\n"
        for i in {1..10}; do
            points=$((1000 - i * 50))
            machines=("Blue Falcon" "Golden Fox" "Wild Goose" "Fire Stingray")
            machine=${machines[$((RANDOM % 4))]}
            assist="false"
            submit_score $i $points "$machine" $assist 0 $i &
        done
        wait
        ;;
    4)
        read -p "Number of players: " num_players
        read -p "Delay between submissions (seconds): " delay

        echo -e "\n${GREEN}Starting CUSTOM test...${NC}\n"
        for ((i=1; i<=num_players; i++)); do
            points=$((1000 - i * 20 + RANDOM % 30))
            machines=("Blue Falcon" "Golden Fox" "Wild Goose" "Fire Stingray")
            machine=${machines[$((RANDOM % 4))]}
            assist="false"
            if [[ $((RANDOM % 100)) -gt 70 ]]; then
                assist="true"
            fi
            submit_score $i $points "$machine" $assist $delay $i
        done
        ;;
    *)
        echo "Invalid choice"
        exit 1
        ;;
esac

echo ""
echo -e "${GREEN}✅ Test complete!${NC}"
echo -e "📊 View results at: ${BLUE}http://localhost:3001/matches/${MODE}/${SEASON}/${GAME}${NC}"
echo ""
echo -e "${YELLOW}💡 TIP:${NC} Open the match page in your browser BEFORE running this test"
echo "        to see the realtime updates as scores come in!"