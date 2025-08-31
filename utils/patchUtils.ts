
/**
 * Applies a structured patch from an XML string to the original content of a file.
 * This function is the core of the token-efficient "Structured Patch" mechanism.
 * @param originalContent The original string content of the file.
 * @param patchXmlString An XML string containing one `<change>` tag with patch operations.
 * @returns The new file content after applying the patch.
 * @throws An error if the patch XML is invalid or an operation fails.
 */
export function applyStructuredChanges(originalContent: string, patchXmlString: string): string {
    const parser = new DOMParser();
    const xmlDoc = parser.parseFromString(patchXmlString, "application/xml");
    
    const errorNode = xmlDoc.querySelector('parsererror');
    if (errorNode) {
      throw new Error(`XML parsing error: ${errorNode.textContent}`);
    }
  
    let modifiedContent = originalContent;
    const changeNode = xmlDoc.getElementsByTagName('change')[0];
    if (!changeNode) {
        // If it's not a patch, it might be the full <changes> block. Let's look for the first change.
        const changesNode = xmlDoc.getElementsByTagName('changes')[0];
        const firstChange = changesNode?.getElementsByTagName('change')[0];
        if(!firstChange) throw new Error("Invalid patch XML: No <change> tag found.");
        return applyStructuredChanges(originalContent, firstChange.outerHTML);
    }

    const operations = Array.from(changeNode.children);
  
    for (const node of operations) {
      const nodeContent = node.textContent ?? '';
  
      switch (node.tagName) {
        case 'insert': {
          const afterLine = node.getAttribute('after_line');
          const beforeLine = node.getAttribute('before_line');
          
          if (!afterLine && !beforeLine && originalContent === '') { // Creating a new file
            modifiedContent = nodeContent;
            continue;
          }

          if (!afterLine && !beforeLine) {
            throw new Error("Insert operation failed: must specify 'after_line' or 'before_line' attribute.");
          }

          const anchorLine = (afterLine ?? beforeLine) as string;
          const lines = modifiedContent.split('\n');
          const anchorIndex = lines.findIndex(line => line.includes(anchorLine));

          if (anchorIndex === -1) {
            throw new Error(`Insert failed: anchor line "${anchorLine}" not found in the file.`);
          }
          
          // Check for uniqueness
          // FIX: Replace findLastIndex with a compatible alternative for older TS/JS targets.
          let lastAnchorIndex = -1;
          for (let i = lines.length - 1; i >= 0; i--) {
            if (lines[i].includes(anchorLine)) {
              lastAnchorIndex = i;
              break;
            }
          }
          if (anchorIndex !== lastAnchorIndex) {
            throw new Error(`Insert failed: anchor line "${anchorLine}" is not unique in the file.`);
          }

          if (afterLine) {
            lines.splice(anchorIndex + 1, 0, nodeContent);
          } else {
            lines.splice(anchorIndex, 0, nodeContent);
          }
          modifiedContent = lines.join('\n');
          break;
        }
        
        case 'replace': {
          const sourceNode = node.getElementsByTagName('source')[0];
          const newNode = node.getElementsByTagName('new')[0];
          if (!sourceNode || !newNode) {
            throw new Error("Invalid replace operation: must contain <source> and <new> tags.");
          }
          const sourceContent = sourceNode.textContent ?? '';
          const newContent = newNode.textContent ?? '';

          if (!modifiedContent.includes(sourceContent)) {
            throw new Error(`Replace failed: source content not found in the file.`);
          }
          modifiedContent = modifiedContent.replace(sourceContent, newContent);
          break;
        }

        case 'delete': {
            const deleteContent = node.textContent ?? '';
            if (!modifiedContent.includes(deleteContent)) {
              throw new Error(`Delete failed: content to delete not found in the file.`);
            }
            modifiedContent = modifiedContent.replace(deleteContent, '');
            break;
        }

        case 'description':
          // Description tag is for metadata, ignore it during application.
          break;
  
        default:
          throw new Error(`Unsupported patch operation: <${node.tagName}>`);
      }
    }
  
    return modifiedContent;
  }
