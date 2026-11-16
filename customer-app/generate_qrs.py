import qrcode

# Replace this with your actual deployed customer app URL (or local network IP)
BASE_URL = "https://schezwan-delight.vercel.app"
print("Generating table QR codes...")

for table_num in range(1, 11):
    # Construct the unique URL for each table
    target_url = f"{BASE_URL}/order?table={table_num}"
    
    # Configure QR code properties for high quality printing
    qr = qrcode.QRCode(
        version=1,
        error_correction=qrcode.constants.ERROR_CORRECT_H, # High error correction
        box_size=10,
        border=4,
    )
    
    qr.add_data(target_url)
    qr.make(fit=True)
    
    # Create image
    img = qr.make_image(fill_color="black", back_color="white")
    
    # Save to file
    filename = f"table_{table_num}_qr.png"
    img.save(filename)
    print(f"-> Generated: {filename} (Links to: {target_url})")

print("\nAll 10 QR codes generated successfully and saved in your directory!")