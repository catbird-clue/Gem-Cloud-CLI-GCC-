

/**
 * Extracts the full content of a file from a <change> XML block.
 * This function expects the XML to contain a single `<change>` tag with a `<content>` tag inside.
 * @param changeXmlString An XML string containing one `<change>` tag.
 * @returns The new file content from within the `<content>` tag.
 * @throws An error if the XML is invalid or the required tags are not found.
 */
export function extractFullContentFromChangeXml(changeXmlString: string): string {
    const parser = new DOMParser();
    const xmlDoc = parser.parseFromString(changeXmlString, "application/xml");
    
    const errorNode = xmlDoc.querySelector('parsererror');
    if (errorNode) {
      throw new Error(`XML parsing error: ${errorNode.textContent}`);
    }

    const changeNode = xmlDoc.getElementsByTagName('change')[0];
    if (!changeNode) {
        throw new Error("Invalid change XML: No <change> tag found.");
    }
    
    // The only supported method is full content replacement.
    const contentNode = changeNode.getElementsByTagName('content')[0];
    if (!contentNode) {
        const childNodes = Array.from(changeNode.children).map(node => node.tagName).join(', ');
        const fileAttr = changeNode.getAttribute('file');
        let errorMsg = `Invalid change XML for file "${fileAttr}": A <content> tag with the full file content is required.`;
        if (childNodes) {
            errorMsg += ` Found these tags instead: <${childNodes}>.`;
        } else {
            errorMsg += ` The <change> tag was empty.`
        }
        throw new Error(errorMsg);
    }

    // The `textContent` will be null if the node is empty, so default to an empty string.
    // This correctly handles file deletions where the content tag is empty.
    return contentNode.textContent ?? '';
}