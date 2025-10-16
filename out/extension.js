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
    let inVectorListSection = false;
    let inBoundSection = false;
    for (let lineIndex = 0; lineIndex < document.lineCount; lineIndex++) {
        const line = document.lineAt(lineIndex);
        const text = line.text.trim();
        // Track sections
        if (text.match(/^\[VectorList\]/)) {
            inVectorListSection = true;
            inBoundSection = false;
            continue;
        }
        else if (text.match(/^\[BoundList_\d+\]/)) {
            inBoundSection = true;
            inVectorListSection = false;
            continue;
        }
        else if (text.startsWith('[')) {
            inVectorListSection = false;
            inBoundSection = false;
            continue;
        }
        // Skip comments and empty lines
        if (text.startsWith('//') || text.length === 0 || text === 'END') {
            continue;
        }
        if (inVectorListSection) {
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
        else if (inBoundSection) {
            // Vector references in bound sections: Vec01 = ...
            const refMatch = text.match(/^\s*Vec(\d{2})\s*=/);
            if (refMatch) {
                // This is just slot assignment, not a duplicate check
                continue;
            }
        }
        else {
            // Vector definition headers: ID Name Count Ukemi Priority Ani Ko
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
            // Vector data rows that reference base vectors
            const dataMatch = text.match(/^\s+(\d+)\s+\d+\s+\d+/);
            if (dataMatch) {
                const refId = dataMatch[1].padStart(3, '0'); // Convert to 3-digit format
                if (!vectorReferences.has(refId)) {
                    vectorReferences.set(refId, []);
                }
                vectorReferences.get(refId).push(lineIndex);
            }
        }
    }
    // Check for undefined vector references
    for (const [refId, lineNumbers] of vectorReferences.entries()) {
        if (!vectorDefinitions.has(refId)) {
            for (const lineIndex of lineNumbers) {
                const diagnostic = new vscode.Diagnostic(new vscode.Range(lineIndex, 0, lineIndex, refId.length), `Vector reference "${refId}" has no definition in VectorList section`, vscode.DiagnosticSeverity.Warning);
                diagnosticList.push(diagnostic);
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