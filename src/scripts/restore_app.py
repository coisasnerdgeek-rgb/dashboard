import os

def restore_app():
    app_path = 'App.tsx'
    block_path = 'switch_block.txt'
    
    if not os.path.exists(block_path):
        print(f"Error: {block_path} not found.")
        return

    # Read the clean block
    with open(block_path, 'r', encoding='utf-8') as f:
        new_block = f.readlines()

    # Read the original file
    with open(app_path, 'r', encoding='utf-8', errors='ignore') as f:
        lines = f.readlines()

    start = -1
    for i, line in enumerate(lines):
        if 'switch (currentView) {' in line:
            start = i
            break
    
    if start == -1:
        print("Error: 'switch (currentView) {' not found in App.tsx")
        return

    end = -1
    for i in range(start, len(lines)):
        if 'default:' in lines[i]:
            end = i
            break
            
    if end == -1:
        print("Error: 'default:' not found after switch start in App.tsx")
        return

    # Replace the block
    print(f"Replacing lines {start+1} to {end+1} with clean content.")
    lines[start:end+1] = new_block

    # Final deep clean: strip each line of trailing garbage and \r
    final_lines = []
    for line in lines:
        # If the line has more than one newline or carriage return in the middle, it's still corrupted
        # But our splines logic earlier should have helped.
        # We ensure one \n at the end and no \r.
        clean_line = line.rstrip('\r\n') + '\n'
        final_lines.append(clean_line)

    with open(app_path, 'w', encoding='utf-8') as f:
        f.writelines(final_lines)
    
    print("SUCCESS: App.tsx restored.")

if __name__ == "__main__":
    restore_app()
