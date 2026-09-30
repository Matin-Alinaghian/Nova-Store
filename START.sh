#!/bin/bash

echo ""

if ! command -v python3 &> /dev/null; then
    exit 1
fi

if ! command -v mysql &> /dev/null; then
    exit 1
fi

echo ""

pip install -r requirements.txt

if [ $? -ne 0 ]; then
    exit 1
fi

echo ""

echo ""
echo ""
echo "   mysql -u root -p"
echo ""
echo "   SOURCE database/schema.sql;"
echo ""
read -p "فشار دهید تا ادامه دهید..."
echo ""

echo ""
echo ""

python3 backend/app.py

if [ $? -ne 0 ]; then
    exit 1
fi