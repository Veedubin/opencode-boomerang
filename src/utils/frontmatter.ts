/**
 * Frontmatter Parsing Utilities
 * 
 * Shared YAML frontmatter parsing for markdown files (agents and skills).
 */

/**
 * Parse YAML frontmatter from markdown content
 */
export function parseFrontmatter(content: string): Record<string, string> {
  const frontmatter: Record<string, string> = {};
  const match = content.match(/^---\n([\s\S]*?)\n---/);

  if (!match) {
    return frontmatter;
  }

  const lines = match[1].split('\n');
  let currentKey = '';
  let currentValue = '';
  let inMultiline = false;

  for (const line of lines) {
    if (inMultiline) {
      if (line.startsWith('    ') || line.startsWith('\t')) {
        // Continuation of multiline value
        currentValue += '\n' + line.replace(/^[ ]{4}|^\t/, '');
      } else {
        // End of multiline value
        frontmatter[currentKey] = currentValue.trim();
        inMultiline = false;
      }
    }

    const keyMatch = line.match(/^(\w+):\s*(.*)/);
    if (keyMatch) {
      currentKey = keyMatch[1];
      currentValue = keyMatch[2];

      if (currentValue === '' || currentValue === '|') {
        inMultiline = true;
      } else {
        frontmatter[currentKey] = currentValue.trim();
      }
    }
  }

  return frontmatter;
}

/**
 * Extract content after frontmatter (the main body)
 */
export function extractContent(content: string): string {
  const match = content.match(/^---\n[\s\S]*?\n---\n?([\s\S]*)/);
  return match ? match[1].trim() : content;
}

/**
 * Parse skills array from frontmatter value
 * Handles YAML array format: [\n  "- skill1"\n  "- skill2"\n]
 */
export function parseSkillsArray(frontmatterValue: string): string[] {
  const skillsMatch = frontmatterValue.match(/\[([\s\S]*?)\]/);
  if (!skillsMatch) {
    return [];
  }

  const skillsContent = skillsMatch[1];
  return skillsContent
    .split('\n')
    .map(s => s.replace(/^\s*["']|["']\s*$/g, '').trim())
    .filter(s => s.length > 0);
}