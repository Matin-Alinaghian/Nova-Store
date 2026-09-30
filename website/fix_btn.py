#!/usr/bin/env python3
import os

# Fix CSS file
with open('frontend/css/style.css', 'r', encoding='utf-8') as f:
    content = f.read()

old_btn = """.btn-logout {
    background: transparent !important;
    border: none !important;
    color: var(--text-secondary) !important;
    text-decoration: none;
    font-weight: 500;
    transition: all 0.3s ease;
    position: relative;
    padding: 0.5rem 0;
    cursor: pointer;
    display: none !important;
}"""

new_btn = """.btn-logout {
    background: transparent !important;
    border: none !important;
    color: var(--text-secondary) !important;
    text-decoration: none;
    font-weight: 500;
    font-family: 'Vazirmatn', 'Poppins', sans-serif;
    font-size: 1rem;
    line-height: 1.6;
    transition: all 0.3s ease;
    position: relative;
    padding: 0.5rem 0;
    cursor: pointer;
    display: none !important;
}"""

if old_btn in content:
    content = content.replace(old_btn, new_btn)
    with open('frontend/css/style.css', 'w', encoding='utf-8') as f:
        f.write(content)
    print('CSS updated successfully')
else:
    print('Pattern not found in CSS')
