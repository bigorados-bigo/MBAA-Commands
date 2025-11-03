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
    const seenIds = new Map(); // Normalized ID -> line numbers
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
            const normalizedId = parseInt(id, 10).toString(); // Normalize: 007, 07, 7 -> "7"
            if (!seenIds.has(normalizedId)) {
                seenIds.set(normalizedId, []);
            }
            seenIds.get(normalizedId).push(lineIndex);
        }
    }
    // Create diagnostics for all duplicate IDs
    for (const [id, lineNumbers] of seenIds.entries()) {
        if (lineNumbers.length > 1) {
            for (const lineIndex of lineNumbers) {
                const line = document.lineAt(lineIndex);
                const match = line.text.match(/^\s*(\d+)\s+/);
                if (match) {
                    const diagnostic = new vscode.Diagnostic(new vscode.Range(lineIndex, 0, lineIndex, match[1].length), `Duplicate command ID "${id}" (appears ${lineNumbers.length} times on lines ${lineNumbers.map(n => n + 1).join(', ')})`, vscode.DiagnosticSeverity.Error);
                    diagnosticList.push(diagnostic);
                }
            }
        }
    }
    diagnostics.set(document.uri, diagnosticList);
}
function validateVectorFile(document, diagnostics) {
    const diagnosticList = [];
    const vectorDefinitions = new Map(); // Vector ID -> line numbers
    const vectorReferences = new Map(); // Vector ID -> line numbers where referenced
    const seenDefinitionIds = new Map(); // Definition ID -> line numbers
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
            if (!sectionHeaders.has(sectionName)) {
                sectionHeaders.set(sectionName, []);
            }
            sectionHeaders.get(sectionName).push(lineIndex);
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
        else if (text.match(/^\[(HitStop|Etc)\]/)) {
            currentSection = 'ignore'; // Ignore HitStop and Etc sections
            sectionBoundIds = new Map();
            continue;
        }
        else if (text.startsWith('[')) {
            currentSection = 'other';
            sectionBoundIds = new Map();
            continue;
        }
        // Handle comments that begin special ignore sections
        if (text.startsWith('//')) {
            if (/ヒットストップ|hitstop/i.test(text) || text.includes('画面端反動')) {
                currentSection = 'ignore';
                sectionBoundIds = new Map();
            }
            continue;
        }
        // Skip empty lines and END markers
        if (text.length === 0 || text === 'END') {
            continue;
        }
        // Skip ignored sections
        if (currentSection === 'ignore') {
            continue;
        }
        if (currentSection === 'vectorlist') {
            // Vector definitions: Vec_001 = x, y, addx, addy
            const vecMatch = text.match(/^\s*Vec_(\d{3})\s*=/);
            if (vecMatch) {
                const id = vecMatch[1];
                const normalizedId = parseInt(id, 10).toString(); // Normalize: 001, 01, 1 -> "1"
                if (!vectorDefinitions.has(normalizedId)) {
                    vectorDefinitions.set(normalizedId, []);
                }
                vectorDefinitions.get(normalizedId).push(lineIndex);
            }
        }
        else if (currentSection === 'boundlist' || currentSection === 'sample') {
            // Vector slot assignments in bound/sample sections: Vec01 = ... or Vec00 = ...
            const slotMatch = text.match(/^\s*Vec(\d{2})\s*=/);
            if (slotMatch) {
                const slotId = slotMatch[1];
                const normalizedSlotId = parseInt(slotId, 10).toString(); // Normalize: 01, 1 -> "1"
                if (!sectionBoundIds.has(normalizedSlotId)) {
                    sectionBoundIds.set(normalizedSlotId, []);
                }
                sectionBoundIds.get(normalizedSlotId).push(lineIndex);
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
                const normalizedId = parseInt(id, 10).toString(); // Normalize
                if (!seenDefinitionIds.has(normalizedId)) {
                    seenDefinitionIds.set(normalizedId, []);
                }
                seenDefinitionIds.get(normalizedId).push(lineIndex);
            }
            // Simple vector rows in main section: ID x y addx addy (like "0  900 0 -70 0 // 頭弱")
            const simpleMatch = text.match(/^\s*(\d+)\s+([+-]?\d+)\s+([+-]?\d+)\s+([+-]?\d+)\s+([+-]?\d+)(?:\s*\/\/.*)?$/);
            if (simpleMatch) {
                const id = simpleMatch[1];
                const normalizedId = parseInt(id, 10).toString(); // Normalize
                if (!simpleVectorIds.has(normalizedId)) {
                    simpleVectorIds.set(normalizedId, []);
                }
                simpleVectorIds.get(normalizedId).push(lineIndex);
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
    // Create diagnostics for all duplicate section headers
    for (const [sectionName, lineNumbers] of sectionHeaders.entries()) {
        if (lineNumbers.length > 1) {
            for (const lineIndex of lineNumbers) {
                const line = document.lineAt(lineIndex);
                const diagnostic = new vscode.Diagnostic(new vscode.Range(lineIndex, 0, lineIndex, line.text.trim().length), `Duplicate section header "${sectionName}" (appears ${lineNumbers.length} times on lines ${lineNumbers.map(n => n + 1).join(', ')})`, vscode.DiagnosticSeverity.Error);
                diagnosticList.push(diagnostic);
            }
        }
    }
    // Create diagnostics for all duplicate vector definitions in VectorList
    for (const [id, lineNumbers] of vectorDefinitions.entries()) {
        if (lineNumbers.length > 1) {
            for (const lineIndex of lineNumbers) {
                const line = document.lineAt(lineIndex);
                const vecMatch = line.text.match(/^\s*Vec_(\d{3})\s*=/);
                if (vecMatch) {
                    const diagnostic = new vscode.Diagnostic(new vscode.Range(lineIndex, 0, lineIndex, vecMatch[0].length), `Duplicate vector definition "${id}" (appears ${lineNumbers.length} times on lines ${lineNumbers.map(n => n + 1).join(', ')})`, vscode.DiagnosticSeverity.Error);
                    diagnosticList.push(diagnostic);
                }
            }
        }
    }
    // Create diagnostics for all duplicate definition IDs in main section
    for (const [id, lineNumbers] of seenDefinitionIds.entries()) {
        if (lineNumbers.length > 1) {
            for (const lineIndex of lineNumbers) {
                const line = document.lineAt(lineIndex);
                const defMatch = line.text.match(/^\s*(\d+)\s+/);
                if (defMatch) {
                    const diagnostic = new vscode.Diagnostic(new vscode.Range(lineIndex, 0, lineIndex, defMatch[1].length), `Duplicate vector definition ID "${id}" (appears ${lineNumbers.length} times on lines ${lineNumbers.map(n => n + 1).join(', ')})`, vscode.DiagnosticSeverity.Error);
                    diagnosticList.push(diagnostic);
                }
            }
        }
    }
    // Create diagnostics for all duplicate simple vector IDs in main section
    for (const [id, lineNumbers] of simpleVectorIds.entries()) {
        if (lineNumbers.length > 1) {
            for (const lineIndex of lineNumbers) {
                const line = document.lineAt(lineIndex);
                const simpleMatch = line.text.match(/^\s*(\d+)\s+/);
                if (simpleMatch) {
                    const diagnostic = new vscode.Diagnostic(new vscode.Range(lineIndex, 0, lineIndex, simpleMatch[1].length), `Duplicate simple vector ID "${id}" (appears ${lineNumbers.length} times on lines ${lineNumbers.map(n => n + 1).join(', ')})`, vscode.DiagnosticSeverity.Error);
                    diagnosticList.push(diagnostic);
                }
            }
        }
    }
    diagnostics.set(document.uri, diagnosticList);
}
function validateSeListFile(document, diagnostics) {
    const diagnosticList = [];
    const seenIds = new Map(); // Normalized ID -> line numbers
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
            const normalizedId = parseInt(id, 10).toString(); // Normalize: 001, 01, 1 -> "1"
            if (!seenIds.has(normalizedId)) {
                seenIds.set(normalizedId, []);
            }
            seenIds.get(normalizedId).push(lineIndex);
        }
    }
    // Create diagnostics for all duplicate IDs
    for (const [id, lineNumbers] of seenIds.entries()) {
        if (lineNumbers.length > 1) {
            for (const lineIndex of lineNumbers) {
                const line = document.lineAt(lineIndex);
                const match = line.text.match(/^\s*(\d{3})\s*=/);
                if (match) {
                    const diagnostic = new vscode.Diagnostic(new vscode.Range(lineIndex, 0, lineIndex, match[1].length), `Duplicate SeList ID "${id}" (appears ${lineNumbers.length} times on lines ${lineNumbers.map(n => n + 1).join(', ')})`, vscode.DiagnosticSeverity.Error);
                    diagnosticList.push(diagnostic);
                }
            }
        }
    }
    diagnostics.set(document.uri, diagnosticList);
}
function deactivate() { }
//# sourceMappingURL=extension.js.map