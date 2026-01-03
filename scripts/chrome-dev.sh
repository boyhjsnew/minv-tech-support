#!/bin/bash

# Script để mở Chrome với các flags dev
# Usage: ./chrome-dev.sh [URL]

URL=${1:-"http://localhost:3000"}

open -n -a /Applications/Google\ Chrome.app/Contents/MacOS/Google\ Chrome --args --user-data-dir="/tmp/chrome_dev_test" --disable-web-security "$URL"

