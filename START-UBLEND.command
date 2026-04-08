#!/bin/bash
cd /Users/sebvdw/Documents/Code/ublend-stock

# Wait a moment for npm to start, then open browser
sleep 3 && open http://localhost:3000 &

# Start the dev server
npm run dev
