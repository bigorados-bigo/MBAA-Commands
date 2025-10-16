"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.activate = activate;
exports.deactivate = deactivate;
const vscode = require("vscode");
function activate(context) {
    // Create diagnostic collections for each language
    const cmdDiagnostics = vscode.languages.createDiagnosticCollection('mbaa-cmd');
    const vectorDiagnostics = vscode.languages.createDiagnosticCollection('mbaa-vector');
    const selistDiagnostics = vscode.languages.createDiagnosticCollection('mbaa-selist');
    // Register diagnostic providers
    context.subscriptions.push(cmdDiagnostics, vectorDiagnostics, selistDiagnostics, 
    // Listen for document changes
    vscode.workspace.onDidChangeTextDocument(event => {
        validateDocument(event.document, cmdDiagnostics, vectorDiagnostics, selistDiagnostics);
    }), vscode.workspace.onDidOpenTextDocument(document => {
        validateDocument(document, cmdDiagnostics, vectorDiagnostics, selistDiagnostics);
    }), vscode.workspace.onDidSaveTextDocument(document => {
        validateDocument(document, cmdDiagnostics, vectorDiagnostics, selistDiagnostics);
    }));
    // Validate all open documents
    vscode.workspace.textDocuments.forEach(document => {
        validateDocument(document, cmdDiagnostics, vectorDiagnostics, selistDiagnostics);
    });
}
function validateDocument(document, cmdDiagnostics, vectorDiagnostics, selistDiagnostics) {
    if (document.languageId === 'mbaa-cmd') {
        validateCommandFile(document, cmdDiagnostics);
    }
    else if (document.languageId === 'mbaa-vector') {
        validateVectorFile(document, vectorDiagnostics);
    }
    else if (document.languageId === 'mbaa-selist') {
        validateSeListFile(document, selistDiagnostics);
    }
}
function validateCommandFile(document, diagnostics) {
    const diagnosticList = [];
    const seenIds = new Map(); // ID -> first line number
    for (let lineIndex = 0; lineIndex < document.lineCount; lineIndex++) {
        const line = document.lineAt(lineIndex);
        const text = line.text.trim();
        // Skip comments and empty lines
        if (text.startsWith('//') || text.length === 0 || text.startsWith('[') || text.includes('=') || text === 'END') {
            continue;
        }
        // Match command rows: ID followed by command
        const match = text.match(/^\s*(\d+)\s+/);
        if (match) {
            const id = match[1];
            if (seenIds.has(id)) {
                const firstLine = seenIds.get(id);
                const diagnostic = new vscode.Diagnostic(new vscode.Range(lineIndex, 0, lineIndex, id.length), `Duplicate command ID "${id}" (first defined on line ${firstLine + 1})`, vscode.DiagnosticSeverity.Error);
                diagnosticList.push(diagnostic);
            }
            else {
                seenIds.set(id, lineIndex);
            }
        }
    }
    diagnostics.set(document.uri, diagnosticList);
}
function validateVectorFile(document, diagnostics) {
    const diagnosticList = [];
    const vectorDefinitions = new Map(); // Vector ID -> line number
    const vectorReferences = new Map(); // Vector ID -> line numbers where referenced
    const seenDefinitionIds = new Map(); // Definition ID -> line number
    const boundSectionIds = new Map(); // BoundList/Sample IDs per section
    const sectionHeaders = new Map(); // Track section header duplicates
    const simpleVectorIds = new Map(); // Simple vector row IDs in main section
    let currentSection = 'main'; // 'main', 'vectorlist', 'boundlist', 'sample'
    let sectionBoundIds = new Map();
    for (let lineIndex = 0; lineIndex < document.lineCount; lineIndex++) {
        const line = document.lineAt(lineIndex);
        const text = line.text.trim();
        // Check for section header duplicates
        const sectionMatch = text.match(/^\[(\w+_\d+)\]$/) || text.match(/^\[(VectorList|HitStop|Etc)\]$/);
        if (sectionMatch) {
            const sectionName = sectionMatch[1];
            if (sectionHeaders.has(sectionName)) {
                const firstLine = sectionHeaders.get(sectionName);
                const diagnostic = new vscode.Diagnostic(new vscode.Range(lineIndex, 0, lineIndex, text.length), `Duplicate section header "${sectionName}" (first defined on line ${firstLine + 1})`, vscode.DiagnosticSeverity.Error);
                diagnosticList.push(diagnostic);
            }
            else {
                sectionHeaders.set(sectionName, lineIndex);
            }
        }
        // Track sections and reset section-specific ID tracking
        if (text.match(/^\[VectorList\]/)) {
            currentSection = 'vectorlist';
            sectionBoundIds = new Map();
            continue;
        }
        else if (text.match(/^\[BoundList_\d+\]/)) {
            currentSection = 'boundlist';
            sectionBoundIds = new Map(); // Reset for each BoundList section
            continue;
        }
        else if (text.match(/^\[BoundSample_\d+\]/)) {
            currentSection = 'sample';
            sectionBoundIds = new Map(); // Reset for each Sample section
            continue;
        }
        else if (text.match(/^\[Sample_\d+\]/)) {
            currentSection = 'sample';
            sectionBoundIds = new Map(); // Reset for each Sample section
            continue;
        }
        else if (text.startsWith('[')) {
            currentSection = 'other';
            sectionBoundIds = new Map();
            continue;
        }
        // Skip comments and empty lines
        if (text.startsWith('//') || text.length === 0 || text === 'END') {
            continue;
        }
        if (currentSection === 'vectorlist') {
            // Vector definitions: Vec_001 = x, y, addx, addy
            const vecMatch = text.match(/^\s*Vec_(\d{3})\s*=/);
            if (vecMatch) {
                const id = vecMatch[1];
                if (vectorDefinitions.has(id)) {
                    const firstLine = vectorDefinitions.get(id);
                    const diagnostic = new vscode.Diagnostic(new vscode.Range(lineIndex, 0, lineIndex, vecMatch[0].length), `Duplicate vector definition "${id}" (first defined on line ${firstLine + 1})`, vscode.DiagnosticSeverity.Error);
                    diagnosticList.push(diagnostic);
                }
                else {
                    vectorDefinitions.set(id, lineIndex);
                }
            }
        }
        else if (currentSection === 'boundlist' || currentSection === 'sample') {
            // Vector slot assignments in bound/sample sections: Vec01 = ... or Vec00 = ...
            const slotMatch = text.match(/^\s*Vec(\d{2})\s*=/);
            if (slotMatch) {
                const slotId = slotMatch[1];
                if (sectionBoundIds.has(slotId)) {
                    const firstLine = sectionBoundIds.get(slotId);
                    const diagnostic = new vscode.Diagnostic(new vscode.Range(lineIndex, 0, lineIndex, slotMatch[0].length), `Duplicate vector slot "${slotId}" in this section (first used on line ${firstLine + 1})`, vscode.DiagnosticSeverity.Error);
                    diagnosticList.push(diagnostic);
                }
                else {
                    sectionBoundIds.set(slotId, lineIndex);
                }
                // Also check if the referenced vector exists (extract base vector reference)
                const dataMatch = text.match(/^\s*Vec\d{2}\s*=\s*(\d+)/);
                if (dataMatch) {
                    const refId = dataMatch[1].padStart(3, '0');
                    if (!vectorReferences.has(refId)) {
                        vectorReferences.set(refId, []);
                    }
                    vectorReferences.get(refId).push(lineIndex);
                }
            }
        }
        else if (currentSection === 'main') {
            // Vector definition headers in main section: ID Name Count Ukemi Priority Ani Ko
            const defMatch = text.match(/^\s*(\d+)\s+([^\d].*?)\s+\d+\s+\d+\s+\d+\s+\d+(?:\s+\d+)?/);
            if (defMatch) {
                const id = defMatch[1];
                if (seenDefinitionIds.has(id)) {
                    const firstLine = seenDefinitionIds.get(id);
                    const diagnostic = new vscode.Diagnostic(new vscode.Range(lineIndex, 0, lineIndex, id.length), `Duplicate vector definition ID "${id}" (first defined on line ${firstLine + 1})`, vscode.DiagnosticSeverity.Error);
                    diagnosticList.push(diagnostic);
                }
                else {
                    seenDefinitionIds.set(id, lineIndex);
                }
            }
            // Simple vector rows in main section: ID x y addx addy (like "0  900 0 -70 0 // 頭弱")
            const simpleMatch = text.match(/^\s*(\d+)\s+([+-]?\d+)\s+([+-]?\d+)\s+([+-]?\d+)\s+([+-]?\d+)(?:\s*\/\/.*)?$/);
            if (simpleMatch) {
                const id = simpleMatch[1];
                if (simpleVectorIds.has(id)) {
                    const firstLine = simpleVectorIds.get(id);
                    const diagnostic = new vscode.Diagnostic(new vscode.Range(lineIndex, 0, lineIndex, id.length), `Duplicate simple vector ID "${id}" (first defined on line ${firstLine + 1})`, vscode.DiagnosticSeverity.Error);
                    diagnosticList.push(diagnostic);
                }
                else {
                    simpleVectorIds.set(id, lineIndex);
                }
            }
            // Vector data rows that reference base vectors in main section
            const dataMatch = text.match(/^\s+(\d+)\s+\d+\s+\d+/);
            if (dataMatch) {
                const refId = dataMatch[1].padStart(3, '0');
                if (!vectorReferences.has(refId)) {
                    vectorReferences.set(refId, []);
                }
                vectorReferences.get(refId).push(lineIndex);
            }
        }
    }
    // Check for undefined vector references (only if we have VectorList definitions)
    if (vectorDefinitions.size > 0) {
        for (const [refId, lineNumbers] of vectorReferences.entries()) {
            if (!vectorDefinitions.has(refId)) {
                for (const lineIndex of lineNumbers) {
                    const diagnostic = new vscode.Diagnostic(new vscode.Range(lineIndex, 0, lineIndex, refId.length), `Vector reference "${refId}" has no definition in VectorList section`, vscode.DiagnosticSeverity.Warning);
                    diagnosticList.push(diagnostic);
                }
            }
        }
    }
    diagnostics.set(document.uri, diagnosticList);
}
function validateSeListFile(document, diagnostics) {
    const diagnosticList = [];
    const seenIds = new Map(); // ID -> first line number
    for (let lineIndex = 0; lineIndex < document.lineCount; lineIndex++) {
        const line = document.lineAt(lineIndex);
        const text = line.text.trim();
        // Skip comments and empty lines
        if (text.startsWith('//') || text.length === 0 || text.startsWith('[') || text === 'END') {
            continue;
        }
        // Match SeList entries: 001 = filename
        const match = text.match(/^\s*(\d{3})\s*=/);
        if (match) {
            const id = match[1];
            if (seenIds.has(id)) {
                const firstLine = seenIds.get(id);
                const diagnostic = new vscode.Diagnostic(new vscode.Range(lineIndex, 0, lineIndex, id.length), `Duplicate SeList ID "${id}" (first defined on line ${firstLine + 1})`, vscode.DiagnosticSeverity.Error);
                diagnosticList.push(diagnostic);
            }
            else {
                seenIds.set(id, lineIndex);
            }
        }
    }
    diagnostics.set(document.uri, diagnosticList);
}
function deactivate() { }
//# sourceMappingURL=extension.js.map