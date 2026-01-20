import __vite__cjsImport0_react_jsxDevRuntime from "/node_modules/.vite/deps/react_jsx-dev-runtime.js?v=7889e533"; const _jsxDEV = __vite__cjsImport0_react_jsxDevRuntime["jsxDEV"];
/**
 * @fileoverview Tests for UI Layout Standardization
 * @contract ui-layout-standardization
 * 
 * Validates UI changes:
 * - Page layout padding standardization
 * - Button text, position, and testIds
 * - Validator count labels format
 * - Modal overflow handling
 */ import { describe, it, expect, vi, beforeEach } from "/node_modules/.vite/deps/vitest.js?v=7889e533";
import { render, screen, fireEvent, waitFor } from "/node_modules/.vite/deps/@testing-library_react.js?v=7889e533";
import { BrowserRouter } from "/node_modules/.vite/deps/react-router-dom.js?v=7889e533";
// Mock the api module
vi.mock('@/lib/api', ()=>({
        api: {
            runs: {
                create: vi.fn(),
                uploadFiles: vi.fn(),
                bypassValidator: vi.fn()
            }
        }
    }));
// Mock sonner toast
vi.mock('sonner', ()=>({
        toast: {
            success: vi.fn(),
            error: vi.fn()
        }
    }));
// Import components after mocks
import { NewValidationPage } from "/src/components/new-validation-page.tsx?t=1768866773743";
import { RunPanel } from "/src/components/run-panel.tsx?t=1768867677126";
import { FileUploadDialog } from "/src/components/file-upload-dialog.tsx?t=1768867677126";
// Helper to render with router
const renderWithRouter = (component)=>{
    return render(/*#__PURE__*/ _jsxDEV(BrowserRouter, {
        children: component
    }, void 0, false, {
        fileName: "C:/Coding/gatekeeper/artifacts/2026_01_19_001_ui-layout-standardization/ui-layout-standardization.spec.tsx",
        lineNumber: 43,
        columnNumber: 5
    }, this));
};
// Mock run data for RunPanel tests
const mockRunWithResults = {
    id: 'test-run-123',
    outputId: 'output-123',
    status: 'PASSED',
    passed: true,
    runType: 'CONTRACT',
    currentGate: 1,
    failedAt: null,
    taskPrompt: 'Test task prompt',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    gateResults: [
        {
            id: 'gate-0',
            gateNumber: 0,
            gateName: 'SANITIZATION',
            status: 'PASSED',
            passed: true,
            passedCount: 4,
            failedCount: 0,
            warningCount: 1,
            skippedCount: 0,
            completedAt: new Date().toISOString()
        },
        {
            id: 'gate-1',
            gateNumber: 1,
            gateName: 'CONTRACT',
            status: 'PASSED',
            passed: true,
            passedCount: 8,
            failedCount: 2,
            warningCount: 0,
            skippedCount: 1,
            completedAt: new Date().toISOString()
        }
    ],
    validatorResults: []
};
describe('NewValidationPage - Layout Standardization', ()=>{
    beforeEach(()=>{
        vi.clearAllMocks();
    });
    // @clause CL-UI-001
    it('should render page container with correct padding classes', ()=>{
        const { container } = renderWithRouter(/*#__PURE__*/ _jsxDEV(NewValidationPage, {}, void 0, false, {
            fileName: "C:/Coding/gatekeeper/artifacts/2026_01_19_001_ui-layout-standardization/ui-layout-standardization.spec.tsx",
            lineNumber: 97,
            columnNumber: 44
        }, this));
        const mainContainer = container.querySelector('div.p-8');
        expect(mainContainer).toBeTruthy();
        expect(mainContainer?.className).toContain('p-8');
        expect(mainContainer?.className).toContain('space-y-6');
        expect(mainContainer?.className).not.toContain('max-w-6xl');
        expect(mainContainer?.className).not.toContain('mx-auto');
    });
    // @clause CL-UI-002
    it('should display Run Gates button with correct testId when valid', ()=>{
        renderWithRouter(/*#__PURE__*/ _jsxDEV(NewValidationPage, {}, void 0, false, {
            fileName: "C:/Coding/gatekeeper/artifacts/2026_01_19_001_ui-layout-standardization/ui-layout-standardization.spec.tsx",
            lineNumber: 108,
            columnNumber: 22
        }, this));
        const runGatesButton = screen.getByTestId('btn-run-gates');
        expect(runGatesButton).toBeInTheDocument();
        expect(runGatesButton).toHaveTextContent('Run Gates 0 e 1');
        expect(runGatesButton).toHaveAttribute('type', 'submit');
    });
    // @clause CL-UI-003
    it('should display Cancel button with correct testId when valid', ()=>{
        renderWithRouter(/*#__PURE__*/ _jsxDEV(NewValidationPage, {}, void 0, false, {
            fileName: "C:/Coding/gatekeeper/artifacts/2026_01_19_001_ui-layout-standardization/ui-layout-standardization.spec.tsx",
            lineNumber: 117,
            columnNumber: 22
        }, this));
        const cancelButton = screen.getByTestId('btn-cancel');
        expect(cancelButton).toBeInTheDocument();
        expect(cancelButton).toHaveTextContent('Cancelar');
        expect(cancelButton).toHaveAttribute('type', 'button');
    });
    // @clause CL-UI-004
    it('fails to find Validar Execução button because it was removed', ()=>{
        renderWithRouter(/*#__PURE__*/ _jsxDEV(NewValidationPage, {}, void 0, false, {
            fileName: "C:/Coding/gatekeeper/artifacts/2026_01_19_001_ui-layout-standardization/ui-layout-standardization.spec.tsx",
            lineNumber: 126,
            columnNumber: 22
        }, this));
        const execButton = screen.queryByText(/Validar Execução/i);
        expect(execButton).not.toBeInTheDocument();
        const gatesText = screen.queryByText(/Gates 2-3/i);
        expect(gatesText).not.toBeInTheDocument();
    });
    // @clause CL-UI-005
    it('should align buttons to left with justify-start class', ()=>{
        const { container } = renderWithRouter(/*#__PURE__*/ _jsxDEV(NewValidationPage, {}, void 0, false, {
            fileName: "C:/Coding/gatekeeper/artifacts/2026_01_19_001_ui-layout-standardization/ui-layout-standardization.spec.tsx",
            lineNumber: 135,
            columnNumber: 44
        }, this));
        const buttonContainer = container.querySelector('.flex.items-center.gap-3');
        expect(buttonContainer).toBeTruthy();
        expect(buttonContainer?.className).toContain('justify-start');
        expect(buttonContainer?.className).not.toContain('justify-end');
    });
    // @clause CL-UI-005
    it('should order Run Gates button before Cancel button when rendered', ()=>{
        const { container } = renderWithRouter(/*#__PURE__*/ _jsxDEV(NewValidationPage, {}, void 0, false, {
            fileName: "C:/Coding/gatekeeper/artifacts/2026_01_19_001_ui-layout-standardization/ui-layout-standardization.spec.tsx",
            lineNumber: 144,
            columnNumber: 44
        }, this));
        const buttonContainer = container.querySelector('.flex.items-center.justify-start.gap-3');
        expect(buttonContainer).toBeTruthy();
        const buttons = buttonContainer?.querySelectorAll('button');
        expect(buttons?.length).toBeGreaterThanOrEqual(2);
        expect(buttons?.[0]).toHaveAttribute('type', 'submit');
        expect(buttons?.[1]).toHaveAttribute('type', 'button');
    });
});
describe('RunPanel - Validator Count Labels', ()=>{
    beforeEach(()=>{
        vi.clearAllMocks();
    });
    // @clause CL-UI-006
    it('should display expanded Passed label when validators pass', async ()=>{
        renderWithRouter(/*#__PURE__*/ _jsxDEV(RunPanel, {
            run: mockRunWithResults,
            onUploadSuccess: ()=>{}
        }, void 0, false, {
            fileName: "C:/Coding/gatekeeper/artifacts/2026_01_19_001_ui-layout-standardization/ui-layout-standardization.spec.tsx",
            lineNumber: 162,
            columnNumber: 7
        }, this));
        // Gate 0 (Sanitization) is shown by default
        expect(screen.getByText(/4 Passed/)).toBeInTheDocument();
        // Click on Contract tab to see Gate 1
        const contractTab = screen.getByTestId('tab-contract');
        fireEvent.click(contractTab);
        await waitFor(()=>{
            expect(screen.getByText(/8 Passed/)).toBeInTheDocument();
        });
    });
    // @clause CL-UI-007
    it('should display expanded Failed label when validators fail', async ()=>{
        renderWithRouter(/*#__PURE__*/ _jsxDEV(RunPanel, {
            run: mockRunWithResults,
            onUploadSuccess: ()=>{}
        }, void 0, false, {
            fileName: "C:/Coding/gatekeeper/artifacts/2026_01_19_001_ui-layout-standardization/ui-layout-standardization.spec.tsx",
            lineNumber: 182,
            columnNumber: 7
        }, this));
        // Gate 0 (Sanitization) is shown by default
        expect(screen.getByText(/0 Failed/)).toBeInTheDocument();
        // Click on Contract tab to see Gate 1
        const contractTab = screen.getByTestId('tab-contract');
        fireEvent.click(contractTab);
        await waitFor(()=>{
            expect(screen.getByText(/2 Failed/)).toBeInTheDocument();
        });
    });
    // @clause CL-UI-008
    it('should use larger font size text-[13px] for count labels', ()=>{
        const { container } = renderWithRouter(/*#__PURE__*/ _jsxDEV(RunPanel, {
            run: mockRunWithResults,
            onUploadSuccess: ()=>{}
        }, void 0, false, {
            fileName: "C:/Coding/gatekeeper/artifacts/2026_01_19_001_ui-layout-standardization/ui-layout-standardization.spec.tsx",
            lineNumber: 202,
            columnNumber: 7
        }, this));
        const countContainers = container.querySelectorAll('.flex.items-center.gap-3');
        const hasLargerFont = Array.from(countContainers).some((el)=>el.className.includes('text-[13px]'));
        expect(hasLargerFont).toBe(true);
    });
});
describe('FileUploadDialog - Overflow Handling', ()=>{
    beforeEach(()=>{
        vi.clearAllMocks();
    });
    // @clause CL-UI-009
    it('should have overflow-x-hidden on DialogContent when open', ()=>{
        render(/*#__PURE__*/ _jsxDEV(FileUploadDialog, {
            open: true,
            onClose: ()=>{},
            runId: "test-run-123"
        }, void 0, false, {
            fileName: "C:/Coding/gatekeeper/artifacts/2026_01_19_001_ui-layout-standardization/ui-layout-standardization.spec.tsx",
            lineNumber: 223,
            columnNumber: 7
        }, this));
        // Dialog renders in a portal, search in document.body
        const dialogContent = document.body.querySelector('[class*="overflow-y-auto"][class*="overflow-x-hidden"]');
        expect(dialogContent).toBeTruthy();
        expect(dialogContent?.className).toContain('overflow-x-hidden');
    });
});

//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbInVpLWxheW91dC1zdGFuZGFyZGl6YXRpb24uc3BlYy50c3giXSwic291cmNlc0NvbnRlbnQiOlsiLyoqXG4gKiBAZmlsZW92ZXJ2aWV3IFRlc3RzIGZvciBVSSBMYXlvdXQgU3RhbmRhcmRpemF0aW9uXG4gKiBAY29udHJhY3QgdWktbGF5b3V0LXN0YW5kYXJkaXphdGlvblxuICogXG4gKiBWYWxpZGF0ZXMgVUkgY2hhbmdlczpcbiAqIC0gUGFnZSBsYXlvdXQgcGFkZGluZyBzdGFuZGFyZGl6YXRpb25cbiAqIC0gQnV0dG9uIHRleHQsIHBvc2l0aW9uLCBhbmQgdGVzdElkc1xuICogLSBWYWxpZGF0b3IgY291bnQgbGFiZWxzIGZvcm1hdFxuICogLSBNb2RhbCBvdmVyZmxvdyBoYW5kbGluZ1xuICovXG5cbmltcG9ydCB7IGRlc2NyaWJlLCBpdCwgZXhwZWN0LCB2aSwgYmVmb3JlRWFjaCB9IGZyb20gJ3ZpdGVzdCdcbmltcG9ydCB7IHJlbmRlciwgc2NyZWVuLCBmaXJlRXZlbnQsIHdhaXRGb3IgfSBmcm9tICdAdGVzdGluZy1saWJyYXJ5L3JlYWN0J1xuaW1wb3J0IHsgQnJvd3NlclJvdXRlciB9IGZyb20gJ3JlYWN0LXJvdXRlci1kb20nXG5cbi8vIE1vY2sgdGhlIGFwaSBtb2R1bGVcbnZpLm1vY2soJ0AvbGliL2FwaScsICgpID0+ICh7XG4gIGFwaToge1xuICAgIHJ1bnM6IHtcbiAgICAgIGNyZWF0ZTogdmkuZm4oKSxcbiAgICAgIHVwbG9hZEZpbGVzOiB2aS5mbigpLFxuICAgICAgYnlwYXNzVmFsaWRhdG9yOiB2aS5mbigpLFxuICAgIH0sXG4gIH0sXG59KSlcblxuLy8gTW9jayBzb25uZXIgdG9hc3RcbnZpLm1vY2soJ3Nvbm5lcicsICgpID0+ICh7XG4gIHRvYXN0OiB7XG4gICAgc3VjY2VzczogdmkuZm4oKSxcbiAgICBlcnJvcjogdmkuZm4oKSxcbiAgfSxcbn0pKVxuXG4vLyBJbXBvcnQgY29tcG9uZW50cyBhZnRlciBtb2Nrc1xuaW1wb3J0IHsgTmV3VmFsaWRhdGlvblBhZ2UgfSBmcm9tICdAL2NvbXBvbmVudHMvbmV3LXZhbGlkYXRpb24tcGFnZSdcbmltcG9ydCB7IFJ1blBhbmVsIH0gZnJvbSAnQC9jb21wb25lbnRzL3J1bi1wYW5lbCdcbmltcG9ydCB7IEZpbGVVcGxvYWREaWFsb2cgfSBmcm9tICdAL2NvbXBvbmVudHMvZmlsZS11cGxvYWQtZGlhbG9nJ1xuXG4vLyBIZWxwZXIgdG8gcmVuZGVyIHdpdGggcm91dGVyXG5jb25zdCByZW5kZXJXaXRoUm91dGVyID0gKGNvbXBvbmVudDogUmVhY3QuUmVhY3ROb2RlKSA9PiB7XG4gIHJldHVybiByZW5kZXIoXG4gICAgPEJyb3dzZXJSb3V0ZXI+XG4gICAgICB7Y29tcG9uZW50fVxuICAgIDwvQnJvd3NlclJvdXRlcj5cbiAgKVxufVxuXG4vLyBNb2NrIHJ1biBkYXRhIGZvciBSdW5QYW5lbCB0ZXN0c1xuY29uc3QgbW9ja1J1bldpdGhSZXN1bHRzID0ge1xuICBpZDogJ3Rlc3QtcnVuLTEyMycsXG4gIG91dHB1dElkOiAnb3V0cHV0LTEyMycsXG4gIHN0YXR1czogJ1BBU1NFRCcgYXMgY29uc3QsXG4gIHBhc3NlZDogdHJ1ZSxcbiAgcnVuVHlwZTogJ0NPTlRSQUNUJyBhcyBjb25zdCxcbiAgY3VycmVudEdhdGU6IDEsXG4gIGZhaWxlZEF0OiBudWxsLFxuICB0YXNrUHJvbXB0OiAnVGVzdCB0YXNrIHByb21wdCcsXG4gIGNyZWF0ZWRBdDogbmV3IERhdGUoKS50b0lTT1N0cmluZygpLFxuICB1cGRhdGVkQXQ6IG5ldyBEYXRlKCkudG9JU09TdHJpbmcoKSxcbiAgZ2F0ZVJlc3VsdHM6IFtcbiAgICB7XG4gICAgICBpZDogJ2dhdGUtMCcsXG4gICAgICBnYXRlTnVtYmVyOiAwLFxuICAgICAgZ2F0ZU5hbWU6ICdTQU5JVElaQVRJT04nLFxuICAgICAgc3RhdHVzOiAnUEFTU0VEJyBhcyBjb25zdCxcbiAgICAgIHBhc3NlZDogdHJ1ZSxcbiAgICAgIHBhc3NlZENvdW50OiA0LFxuICAgICAgZmFpbGVkQ291bnQ6IDAsXG4gICAgICB3YXJuaW5nQ291bnQ6IDEsXG4gICAgICBza2lwcGVkQ291bnQ6IDAsXG4gICAgICBjb21wbGV0ZWRBdDogbmV3IERhdGUoKS50b0lTT1N0cmluZygpLFxuICAgIH0sXG4gICAge1xuICAgICAgaWQ6ICdnYXRlLTEnLFxuICAgICAgZ2F0ZU51bWJlcjogMSxcbiAgICAgIGdhdGVOYW1lOiAnQ09OVFJBQ1QnLFxuICAgICAgc3RhdHVzOiAnUEFTU0VEJyBhcyBjb25zdCxcbiAgICAgIHBhc3NlZDogdHJ1ZSxcbiAgICAgIHBhc3NlZENvdW50OiA4LFxuICAgICAgZmFpbGVkQ291bnQ6IDIsXG4gICAgICB3YXJuaW5nQ291bnQ6IDAsXG4gICAgICBza2lwcGVkQ291bnQ6IDEsXG4gICAgICBjb21wbGV0ZWRBdDogbmV3IERhdGUoKS50b0lTT1N0cmluZygpLFxuICAgIH0sXG4gIF0sXG4gIHZhbGlkYXRvclJlc3VsdHM6IFtdLFxufVxuXG5kZXNjcmliZSgnTmV3VmFsaWRhdGlvblBhZ2UgLSBMYXlvdXQgU3RhbmRhcmRpemF0aW9uJywgKCkgPT4ge1xuICBiZWZvcmVFYWNoKCgpID0+IHtcbiAgICB2aS5jbGVhckFsbE1vY2tzKClcbiAgfSlcblxuICAvLyBAY2xhdXNlIENMLVVJLTAwMVxuICBpdCgnc2hvdWxkIHJlbmRlciBwYWdlIGNvbnRhaW5lciB3aXRoIGNvcnJlY3QgcGFkZGluZyBjbGFzc2VzJywgKCkgPT4ge1xuICAgIGNvbnN0IHsgY29udGFpbmVyIH0gPSByZW5kZXJXaXRoUm91dGVyKDxOZXdWYWxpZGF0aW9uUGFnZSAvPilcbiAgICBjb25zdCBtYWluQ29udGFpbmVyID0gY29udGFpbmVyLnF1ZXJ5U2VsZWN0b3IoJ2Rpdi5wLTgnKVxuICAgIGV4cGVjdChtYWluQ29udGFpbmVyKS50b0JlVHJ1dGh5KClcbiAgICBleHBlY3QobWFpbkNvbnRhaW5lcj8uY2xhc3NOYW1lKS50b0NvbnRhaW4oJ3AtOCcpXG4gICAgZXhwZWN0KG1haW5Db250YWluZXI/LmNsYXNzTmFtZSkudG9Db250YWluKCdzcGFjZS15LTYnKVxuICAgIGV4cGVjdChtYWluQ29udGFpbmVyPy5jbGFzc05hbWUpLm5vdC50b0NvbnRhaW4oJ21heC13LTZ4bCcpXG4gICAgZXhwZWN0KG1haW5Db250YWluZXI/LmNsYXNzTmFtZSkubm90LnRvQ29udGFpbignbXgtYXV0bycpXG4gIH0pXG5cbiAgLy8gQGNsYXVzZSBDTC1VSS0wMDJcbiAgaXQoJ3Nob3VsZCBkaXNwbGF5IFJ1biBHYXRlcyBidXR0b24gd2l0aCBjb3JyZWN0IHRlc3RJZCB3aGVuIHZhbGlkJywgKCkgPT4ge1xuICAgIHJlbmRlcldpdGhSb3V0ZXIoPE5ld1ZhbGlkYXRpb25QYWdlIC8+KVxuICAgIGNvbnN0IHJ1bkdhdGVzQnV0dG9uID0gc2NyZWVuLmdldEJ5VGVzdElkKCdidG4tcnVuLWdhdGVzJylcbiAgICBleHBlY3QocnVuR2F0ZXNCdXR0b24pLnRvQmVJblRoZURvY3VtZW50KClcbiAgICBleHBlY3QocnVuR2F0ZXNCdXR0b24pLnRvSGF2ZVRleHRDb250ZW50KCdSdW4gR2F0ZXMgMCBlIDEnKVxuICAgIGV4cGVjdChydW5HYXRlc0J1dHRvbikudG9IYXZlQXR0cmlidXRlKCd0eXBlJywgJ3N1Ym1pdCcpXG4gIH0pXG5cbiAgLy8gQGNsYXVzZSBDTC1VSS0wMDNcbiAgaXQoJ3Nob3VsZCBkaXNwbGF5IENhbmNlbCBidXR0b24gd2l0aCBjb3JyZWN0IHRlc3RJZCB3aGVuIHZhbGlkJywgKCkgPT4ge1xuICAgIHJlbmRlcldpdGhSb3V0ZXIoPE5ld1ZhbGlkYXRpb25QYWdlIC8+KVxuICAgIGNvbnN0IGNhbmNlbEJ1dHRvbiA9IHNjcmVlbi5nZXRCeVRlc3RJZCgnYnRuLWNhbmNlbCcpXG4gICAgZXhwZWN0KGNhbmNlbEJ1dHRvbikudG9CZUluVGhlRG9jdW1lbnQoKVxuICAgIGV4cGVjdChjYW5jZWxCdXR0b24pLnRvSGF2ZVRleHRDb250ZW50KCdDYW5jZWxhcicpXG4gICAgZXhwZWN0KGNhbmNlbEJ1dHRvbikudG9IYXZlQXR0cmlidXRlKCd0eXBlJywgJ2J1dHRvbicpXG4gIH0pXG5cbiAgLy8gQGNsYXVzZSBDTC1VSS0wMDRcbiAgaXQoJ2ZhaWxzIHRvIGZpbmQgVmFsaWRhciBFeGVjdcOnw6NvIGJ1dHRvbiBiZWNhdXNlIGl0IHdhcyByZW1vdmVkJywgKCkgPT4ge1xuICAgIHJlbmRlcldpdGhSb3V0ZXIoPE5ld1ZhbGlkYXRpb25QYWdlIC8+KVxuICAgIGNvbnN0IGV4ZWNCdXR0b24gPSBzY3JlZW4ucXVlcnlCeVRleHQoL1ZhbGlkYXIgRXhlY3XDp8Ojby9pKVxuICAgIGV4cGVjdChleGVjQnV0dG9uKS5ub3QudG9CZUluVGhlRG9jdW1lbnQoKVxuICAgIGNvbnN0IGdhdGVzVGV4dCA9IHNjcmVlbi5xdWVyeUJ5VGV4dCgvR2F0ZXMgMi0zL2kpXG4gICAgZXhwZWN0KGdhdGVzVGV4dCkubm90LnRvQmVJblRoZURvY3VtZW50KClcbiAgfSlcblxuICAvLyBAY2xhdXNlIENMLVVJLTAwNVxuICBpdCgnc2hvdWxkIGFsaWduIGJ1dHRvbnMgdG8gbGVmdCB3aXRoIGp1c3RpZnktc3RhcnQgY2xhc3MnLCAoKSA9PiB7XG4gICAgY29uc3QgeyBjb250YWluZXIgfSA9IHJlbmRlcldpdGhSb3V0ZXIoPE5ld1ZhbGlkYXRpb25QYWdlIC8+KVxuICAgIGNvbnN0IGJ1dHRvbkNvbnRhaW5lciA9IGNvbnRhaW5lci5xdWVyeVNlbGVjdG9yKCcuZmxleC5pdGVtcy1jZW50ZXIuZ2FwLTMnKVxuICAgIGV4cGVjdChidXR0b25Db250YWluZXIpLnRvQmVUcnV0aHkoKVxuICAgIGV4cGVjdChidXR0b25Db250YWluZXI/LmNsYXNzTmFtZSkudG9Db250YWluKCdqdXN0aWZ5LXN0YXJ0JylcbiAgICBleHBlY3QoYnV0dG9uQ29udGFpbmVyPy5jbGFzc05hbWUpLm5vdC50b0NvbnRhaW4oJ2p1c3RpZnktZW5kJylcbiAgfSlcblxuICAvLyBAY2xhdXNlIENMLVVJLTAwNVxuICBpdCgnc2hvdWxkIG9yZGVyIFJ1biBHYXRlcyBidXR0b24gYmVmb3JlIENhbmNlbCBidXR0b24gd2hlbiByZW5kZXJlZCcsICgpID0+IHtcbiAgICBjb25zdCB7IGNvbnRhaW5lciB9ID0gcmVuZGVyV2l0aFJvdXRlcig8TmV3VmFsaWRhdGlvblBhZ2UgLz4pXG4gICAgY29uc3QgYnV0dG9uQ29udGFpbmVyID0gY29udGFpbmVyLnF1ZXJ5U2VsZWN0b3IoJy5mbGV4Lml0ZW1zLWNlbnRlci5qdXN0aWZ5LXN0YXJ0LmdhcC0zJylcbiAgICBleHBlY3QoYnV0dG9uQ29udGFpbmVyKS50b0JlVHJ1dGh5KClcbiAgICBjb25zdCBidXR0b25zID0gYnV0dG9uQ29udGFpbmVyPy5xdWVyeVNlbGVjdG9yQWxsKCdidXR0b24nKVxuICAgIGV4cGVjdChidXR0b25zPy5sZW5ndGgpLnRvQmVHcmVhdGVyVGhhbk9yRXF1YWwoMilcbiAgICBleHBlY3QoYnV0dG9ucz8uWzBdKS50b0hhdmVBdHRyaWJ1dGUoJ3R5cGUnLCAnc3VibWl0JylcbiAgICBleHBlY3QoYnV0dG9ucz8uWzFdKS50b0hhdmVBdHRyaWJ1dGUoJ3R5cGUnLCAnYnV0dG9uJylcbiAgfSlcbn0pXG5cbmRlc2NyaWJlKCdSdW5QYW5lbCAtIFZhbGlkYXRvciBDb3VudCBMYWJlbHMnLCAoKSA9PiB7XG4gIGJlZm9yZUVhY2goKCkgPT4ge1xuICAgIHZpLmNsZWFyQWxsTW9ja3MoKVxuICB9KVxuXG4gIC8vIEBjbGF1c2UgQ0wtVUktMDA2XG4gIGl0KCdzaG91bGQgZGlzcGxheSBleHBhbmRlZCBQYXNzZWQgbGFiZWwgd2hlbiB2YWxpZGF0b3JzIHBhc3MnLCBhc3luYyAoKSA9PiB7XG4gICAgcmVuZGVyV2l0aFJvdXRlcihcbiAgICAgIDxSdW5QYW5lbFxuICAgICAgICBydW49e21vY2tSdW5XaXRoUmVzdWx0c31cbiAgICAgICAgb25VcGxvYWRTdWNjZXNzPXsoKSA9PiB7fX1cbiAgICAgIC8+XG4gICAgKVxuICAgIC8vIEdhdGUgMCAoU2FuaXRpemF0aW9uKSBpcyBzaG93biBieSBkZWZhdWx0XG4gICAgZXhwZWN0KHNjcmVlbi5nZXRCeVRleHQoLzQgUGFzc2VkLykpLnRvQmVJblRoZURvY3VtZW50KClcblxuICAgIC8vIENsaWNrIG9uIENvbnRyYWN0IHRhYiB0byBzZWUgR2F0ZSAxXG4gICAgY29uc3QgY29udHJhY3RUYWIgPSBzY3JlZW4uZ2V0QnlUZXN0SWQoJ3RhYi1jb250cmFjdCcpXG4gICAgZmlyZUV2ZW50LmNsaWNrKGNvbnRyYWN0VGFiKVxuXG4gICAgYXdhaXQgd2FpdEZvcigoKSA9PiB7XG4gICAgICBleHBlY3Qoc2NyZWVuLmdldEJ5VGV4dCgvOCBQYXNzZWQvKSkudG9CZUluVGhlRG9jdW1lbnQoKVxuICAgIH0pXG4gIH0pXG5cbiAgLy8gQGNsYXVzZSBDTC1VSS0wMDdcbiAgaXQoJ3Nob3VsZCBkaXNwbGF5IGV4cGFuZGVkIEZhaWxlZCBsYWJlbCB3aGVuIHZhbGlkYXRvcnMgZmFpbCcsIGFzeW5jICgpID0+IHtcbiAgICByZW5kZXJXaXRoUm91dGVyKFxuICAgICAgPFJ1blBhbmVsXG4gICAgICAgIHJ1bj17bW9ja1J1bldpdGhSZXN1bHRzfVxuICAgICAgICBvblVwbG9hZFN1Y2Nlc3M9eygpID0+IHt9fVxuICAgICAgLz5cbiAgICApXG4gICAgLy8gR2F0ZSAwIChTYW5pdGl6YXRpb24pIGlzIHNob3duIGJ5IGRlZmF1bHRcbiAgICBleHBlY3Qoc2NyZWVuLmdldEJ5VGV4dCgvMCBGYWlsZWQvKSkudG9CZUluVGhlRG9jdW1lbnQoKVxuXG4gICAgLy8gQ2xpY2sgb24gQ29udHJhY3QgdGFiIHRvIHNlZSBHYXRlIDFcbiAgICBjb25zdCBjb250cmFjdFRhYiA9IHNjcmVlbi5nZXRCeVRlc3RJZCgndGFiLWNvbnRyYWN0JylcbiAgICBmaXJlRXZlbnQuY2xpY2soY29udHJhY3RUYWIpXG5cbiAgICBhd2FpdCB3YWl0Rm9yKCgpID0+IHtcbiAgICAgIGV4cGVjdChzY3JlZW4uZ2V0QnlUZXh0KC8yIEZhaWxlZC8pKS50b0JlSW5UaGVEb2N1bWVudCgpXG4gICAgfSlcbiAgfSlcblxuICAvLyBAY2xhdXNlIENMLVVJLTAwOFxuICBpdCgnc2hvdWxkIHVzZSBsYXJnZXIgZm9udCBzaXplIHRleHQtWzEzcHhdIGZvciBjb3VudCBsYWJlbHMnLCAoKSA9PiB7XG4gICAgY29uc3QgeyBjb250YWluZXIgfSA9IHJlbmRlcldpdGhSb3V0ZXIoXG4gICAgICA8UnVuUGFuZWwgXG4gICAgICAgIHJ1bj17bW9ja1J1bldpdGhSZXN1bHRzfSBcbiAgICAgICAgb25VcGxvYWRTdWNjZXNzPXsoKSA9PiB7fX1cbiAgICAgIC8+XG4gICAgKVxuICAgIGNvbnN0IGNvdW50Q29udGFpbmVycyA9IGNvbnRhaW5lci5xdWVyeVNlbGVjdG9yQWxsKCcuZmxleC5pdGVtcy1jZW50ZXIuZ2FwLTMnKVxuICAgIGNvbnN0IGhhc0xhcmdlckZvbnQgPSBBcnJheS5mcm9tKGNvdW50Q29udGFpbmVycykuc29tZShcbiAgICAgIGVsID0+IGVsLmNsYXNzTmFtZS5pbmNsdWRlcygndGV4dC1bMTNweF0nKVxuICAgIClcbiAgICBleHBlY3QoaGFzTGFyZ2VyRm9udCkudG9CZSh0cnVlKVxuICB9KVxufSlcblxuZGVzY3JpYmUoJ0ZpbGVVcGxvYWREaWFsb2cgLSBPdmVyZmxvdyBIYW5kbGluZycsICgpID0+IHtcbiAgYmVmb3JlRWFjaCgoKSA9PiB7XG4gICAgdmkuY2xlYXJBbGxNb2NrcygpXG4gIH0pXG5cbiAgLy8gQGNsYXVzZSBDTC1VSS0wMDlcbiAgaXQoJ3Nob3VsZCBoYXZlIG92ZXJmbG93LXgtaGlkZGVuIG9uIERpYWxvZ0NvbnRlbnQgd2hlbiBvcGVuJywgKCkgPT4ge1xuICAgIHJlbmRlcihcbiAgICAgIDxGaWxlVXBsb2FkRGlhbG9nXG4gICAgICAgIG9wZW49e3RydWV9XG4gICAgICAgIG9uQ2xvc2U9eygpID0+IHt9fVxuICAgICAgICBydW5JZD1cInRlc3QtcnVuLTEyM1wiXG4gICAgICAvPlxuICAgIClcbiAgICAvLyBEaWFsb2cgcmVuZGVycyBpbiBhIHBvcnRhbCwgc2VhcmNoIGluIGRvY3VtZW50LmJvZHlcbiAgICBjb25zdCBkaWFsb2dDb250ZW50ID0gZG9jdW1lbnQuYm9keS5xdWVyeVNlbGVjdG9yKCdbY2xhc3MqPVwib3ZlcmZsb3cteS1hdXRvXCJdW2NsYXNzKj1cIm92ZXJmbG93LXgtaGlkZGVuXCJdJylcbiAgICBleHBlY3QoZGlhbG9nQ29udGVudCkudG9CZVRydXRoeSgpXG4gICAgZXhwZWN0KGRpYWxvZ0NvbnRlbnQ/LmNsYXNzTmFtZSkudG9Db250YWluKCdvdmVyZmxvdy14LWhpZGRlbicpXG4gIH0pXG59KVxuIl0sIm5hbWVzIjpbImRlc2NyaWJlIiwiaXQiLCJleHBlY3QiLCJ2aSIsImJlZm9yZUVhY2giLCJyZW5kZXIiLCJzY3JlZW4iLCJmaXJlRXZlbnQiLCJ3YWl0Rm9yIiwiQnJvd3NlclJvdXRlciIsIm1vY2siLCJhcGkiLCJydW5zIiwiY3JlYXRlIiwiZm4iLCJ1cGxvYWRGaWxlcyIsImJ5cGFzc1ZhbGlkYXRvciIsInRvYXN0Iiwic3VjY2VzcyIsImVycm9yIiwiTmV3VmFsaWRhdGlvblBhZ2UiLCJSdW5QYW5lbCIsIkZpbGVVcGxvYWREaWFsb2ciLCJyZW5kZXJXaXRoUm91dGVyIiwiY29tcG9uZW50IiwibW9ja1J1bldpdGhSZXN1bHRzIiwiaWQiLCJvdXRwdXRJZCIsInN0YXR1cyIsInBhc3NlZCIsInJ1blR5cGUiLCJjdXJyZW50R2F0ZSIsImZhaWxlZEF0IiwidGFza1Byb21wdCIsImNyZWF0ZWRBdCIsIkRhdGUiLCJ0b0lTT1N0cmluZyIsInVwZGF0ZWRBdCIsImdhdGVSZXN1bHRzIiwiZ2F0ZU51bWJlciIsImdhdGVOYW1lIiwicGFzc2VkQ291bnQiLCJmYWlsZWRDb3VudCIsIndhcm5pbmdDb3VudCIsInNraXBwZWRDb3VudCIsImNvbXBsZXRlZEF0IiwidmFsaWRhdG9yUmVzdWx0cyIsImNsZWFyQWxsTW9ja3MiLCJjb250YWluZXIiLCJtYWluQ29udGFpbmVyIiwicXVlcnlTZWxlY3RvciIsInRvQmVUcnV0aHkiLCJjbGFzc05hbWUiLCJ0b0NvbnRhaW4iLCJub3QiLCJydW5HYXRlc0J1dHRvbiIsImdldEJ5VGVzdElkIiwidG9CZUluVGhlRG9jdW1lbnQiLCJ0b0hhdmVUZXh0Q29udGVudCIsInRvSGF2ZUF0dHJpYnV0ZSIsImNhbmNlbEJ1dHRvbiIsImV4ZWNCdXR0b24iLCJxdWVyeUJ5VGV4dCIsImdhdGVzVGV4dCIsImJ1dHRvbkNvbnRhaW5lciIsImJ1dHRvbnMiLCJxdWVyeVNlbGVjdG9yQWxsIiwibGVuZ3RoIiwidG9CZUdyZWF0ZXJUaGFuT3JFcXVhbCIsInJ1biIsIm9uVXBsb2FkU3VjY2VzcyIsImdldEJ5VGV4dCIsImNvbnRyYWN0VGFiIiwiY2xpY2siLCJjb3VudENvbnRhaW5lcnMiLCJoYXNMYXJnZXJGb250IiwiQXJyYXkiLCJmcm9tIiwic29tZSIsImVsIiwiaW5jbHVkZXMiLCJ0b0JlIiwib3BlbiIsIm9uQ2xvc2UiLCJydW5JZCIsImRpYWxvZ0NvbnRlbnQiLCJkb2N1bWVudCIsImJvZHkiXSwibWFwcGluZ3MiOiI7QUFBQTs7Ozs7Ozs7O0NBU0MsR0FFRCxTQUFTQSxRQUFRLEVBQUVDLEVBQUUsRUFBRUMsTUFBTSxFQUFFQyxFQUFFLEVBQUVDLFVBQVUsUUFBUSxTQUFRO0FBQzdELFNBQVNDLE1BQU0sRUFBRUMsTUFBTSxFQUFFQyxTQUFTLEVBQUVDLE9BQU8sUUFBUSx5QkFBd0I7QUFDM0UsU0FBU0MsYUFBYSxRQUFRLG1CQUFrQjtBQUVoRCxzQkFBc0I7QUFDdEJOLEdBQUdPLElBQUksQ0FBQyxhQUFhLElBQU8sQ0FBQTtRQUMxQkMsS0FBSztZQUNIQyxNQUFNO2dCQUNKQyxRQUFRVixHQUFHVyxFQUFFO2dCQUNiQyxhQUFhWixHQUFHVyxFQUFFO2dCQUNsQkUsaUJBQWlCYixHQUFHVyxFQUFFO1lBQ3hCO1FBQ0Y7SUFDRixDQUFBO0FBRUEsb0JBQW9CO0FBQ3BCWCxHQUFHTyxJQUFJLENBQUMsVUFBVSxJQUFPLENBQUE7UUFDdkJPLE9BQU87WUFDTEMsU0FBU2YsR0FBR1csRUFBRTtZQUNkSyxPQUFPaEIs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