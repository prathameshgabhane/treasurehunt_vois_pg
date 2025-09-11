import qrcode
from PIL import Image, ImageDraw, ImageFont
import os

def create_qr_code_with_label(url, label, filename):
    """Create a QR code with URL and label"""
    
    # Create QR code
    qr = qrcode.QRCode(
        version=1,
        error_correction=qrcode.constants.ERROR_CORRECT_L,
        box_size=10,
        border=4,
    )
    qr.add_data(url)
    qr.make(fit=True)

    # Create QR code image with high contrast
    qr_img = qr.make_image(fill_color="black", back_color="white")
    
    # Create a larger image with space for text
    img_width = 400
    img_height = 500
    img = Image.new('RGB', (img_width, img_height), 'white')
    
    # Resize QR code and center it
    qr_size = 300
    qr_img = qr_img.resize((qr_size, qr_size), Image.Resampling.LANCZOS)
    qr_x = (img_width - qr_size) // 2
    qr_y = 40
    img.paste(qr_img, (qr_x, qr_y))
    
    # Add text
    draw = ImageDraw.Draw(img)
    
    try:
        # Try to load a nice font
        title_font = ImageFont.truetype("arial.ttf", 28)
        url_font = ImageFont.truetype("arial.ttf", 14)
        instruction_font = ImageFont.truetype("arial.ttf", 12)
    except:
        # Fallback to default font
        title_font = ImageFont.load_default()
        url_font = ImageFont.load_default()
        instruction_font = ImageFont.load_default()
    
    # Draw title
    title_text = label
    title_bbox = draw.textbbox((0, 0), title_text, font=title_font)
    title_width = title_bbox[2] - title_bbox[0]
    title_x = (img_width - title_width) // 2
    draw.text((title_x, 10), title_text, fill='black', font=title_font)
    
    # Draw URL
    url_text = url
    url_bbox = draw.textbbox((0, 0), url_text, font=url_font)
    url_width = url_bbox[2] - url_bbox[0]
    url_x = (img_width - url_width) // 2
    draw.text((url_x, 360), url_text, fill='gray', font=url_font)
    
    # Draw instructions
    instruction_text = "Enter your Team ID when prompted"
    instruction_bbox = draw.textbbox((0, 0), instruction_text, font=instruction_font)
    instruction_width = instruction_bbox[2] - instruction_bbox[0]
    instruction_x = (img_width - instruction_width) // 2
    draw.text((instruction_x, 390), instruction_text, fill='blue', font=instruction_font)
    
    # Draw QR code step info
    step_text = f"Scan this QR code to access {label.split(' - ')[1] if ' - ' in label else label}"
    step_bbox = draw.textbbox((0, 0), step_text, font=instruction_font)
    step_width = step_bbox[2] - step_bbox[0]
    step_x = (img_width - step_width) // 2
    draw.text((step_x, 410), step_text, fill='green', font=instruction_font)
    
    # Draw border
    border_width = 3
    draw.rectangle([0, 0, img_width-1, img_height-1], outline='black', width=border_width)
    
    # Save the image
    img.save(filename, 'PNG', quality=95)
    print(f"✅ Created: {filename}")

def main():
    # 🚨 YOUR GITHUB PAGES URL
    base_url = "https://prathameshgabhane.github.io/treasurehunt_vois_sp/"
    
    print("🎯 Generating QR Codes for Treasure Hunt Game")
    print("=" * 50)
    print(f"🌐 Your GitHub Pages URL: {base_url}")
    print()
    
    # Create output directory
    os.makedirs("qr_codes", exist_ok=True)
    
    # Define the 4 basic QR codes (teams enter their ID manually)
    tasks = [
        {
            "url": f"{base_url}/bniexa.html",
            "label": "Task 1 - Start Your Hunt!", 
            "filename": "qr_codes/bniexa_qr.png"
        },
        {
            "url": f"{base_url}/qbltlk.html",
            "label": "Task 2 - Second Clue", 
            "filename": "qr_codes/qbltlk_qr.png"
        },
        {
            "url": f"{base_url}/anoeen.html",
            "label": "Task 3 - Third Clue", 
            "filename": "qr_codes/anoeen_qr.png"
        },
        {
            "url": f"{base_url}/mchdwq.html",
            "label": "Task 4 - Fourth Challenge", 
            "filename": "qr_codes/mchdwq_qr.png"
        },
        {
            "url": f"{base_url}/awnibc.html",
            "label": "Task 5 - WINNER!", 
            "filename": "qr_codes/awnibc_qr.png"
        }
    ]
    
    print("🏗️  Creating QR codes for tasks:")
    print("-" * 40)
    
    # Create QR codes for each task
    for task in tasks:
        create_qr_code_with_label(task["url"], task["label"], task["filename"])
    
    print("\n🎉 All QR codes generated successfully!")
    print("📁 Check the 'qr_codes' folder for your QR code images")
    print()
    print("📋 GAME INSTRUCTIONS:")
    print("=" * 50)
    print("1. 🖨️  Print the 5 QR codes")
    print("2. 📍 Place QR codes at different locations in your office")
    print("3. 👥 Teams scan QR codes in sequence (Task 1 → 2 → 3 → 4 → 5)")
    print("4. 📝 Teams enter their Team ID when prompted (e.g., ALPHA, BRAVO)")
    print("5. 🎮 Teams enter previous task codes to proceed")
    print("6. 📊 Monitor all teams in real-time at: " + base_url + "/admin.html")
    print()
    print("🎯 GAME FLOW:")
    print("-" * 30)
    print("• Task 1: Teams enter their Team ID → Get TC441")
    print("• Task 2: Teams enter Team ID + TC441 → Get TC242") 
    print("• Task 3: Teams enter Team ID + TC242 → Get TC803")
    print("• Task 4: Teams enter Team ID + TC803 → Get TC200")
    print("• Task 5: Teams enter Team ID + TC200 → 🏆 WINNER! 🏆")
    print()
    print("🔥 FIREBASE FEATURES:")
    print("-" * 30)
    print("• ✅ Real-time multi-device tracking")
    print("• ✅ Live admin dashboard updates")
    print("• ✅ Automatic team creation")
    print("• ✅ No pre-registration needed")
    print("• ✅ Teams can use any name (ALPHA, BRAVO, etc.)")
    print()
    print("🚀 Ready for your treasure hunt!")

if __name__ == "__main__":
    main() 