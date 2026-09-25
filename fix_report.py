import re

with open('src/pages/reports/TruckOnlyDeliveriesReport.tsx', 'r') as f:
    content = f.read()

content = content.replace("companyName: companySettings?.companyName", "companyName: companySettings?.name")
content = content.replace("unitPrice: item.unitPrice", "unitPrice: item.priceHT")
content = content.replace("<ProductPickerModal\n        isOpen={showProductPicker}\n        onClose={() => setShowProductPicker(false)}\n        onSelect={(product) => {\n          setSelectedProduct(product);\n          setShowProductPicker(false);\n        }}\n        products={products}\n      />", "<ProductPickerModal\n        isOpen={showProductPicker}\n        onClose={() => setShowProductPicker(false)}\n        onSelect={(product) => {\n          setSelectedProduct(product);\n          setShowProductPicker(false);\n        }}\n        products={products}\n        productPrices={[]}\n      />")

with open('src/pages/reports/TruckOnlyDeliveriesReport.tsx', 'w') as f:
    f.write(content)
