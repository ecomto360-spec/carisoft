import re

with open('src/lib/printReceipt.ts', 'r') as f:
    content = f.read()

# Fix the broken backticks in generateTruckReportHtml
content = content.replace("\\`", "`")
content = content.replace("\\${", "${")
content = content.replace("return `<!DOCTYPE html><html lang=\"fr\">", "return `\n<!DOCTYPE html>\n<html lang=\"fr\">")

with open('src/lib/printReceipt.ts', 'w') as f:
    f.write(content)
