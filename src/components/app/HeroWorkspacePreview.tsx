import { FilePanelBrand } from "@/components/stonecode/FilePanel";
import { StoneEditor } from "@/components/stonecode/StoneEditor";
import { StoneSurface } from "@/components/stonecode/StoneSurface";

const heroCode = `const lessons = [
  { topic: "variables", complete: true },
  { topic: "functions", complete: true },
  { topic: "arrays", complete: false }
];

function nextLesson(items) {
  return items.find((lesson) => !lesson.complete);
}

console.log(nextLesson(lessons));`;

export function HeroWorkspacePreview() {
  return (
    <div className="hero-workspace-preview" aria-label="Stonecode learning workspace preview">
      <HeroCoursePanel />
      <HeroEditorPanel />
      <HeroTutorPanel />
    </div>
  );
}

function HeroCoursePanel() {
  return (
    <StoneSurface as="aside" variant="side" className="hero-workspace-course-panel">
      <FilePanelBrand />
      <div className="file-panel-head">
        <span>Course</span>
        <strong>JavaScript foundations</strong>
      </div>
      <div className="file-panel-tabs" aria-hidden="true">
        <button className="is-active" disabled type="button">Course</button>
        <button disabled type="button">Files</button>
      </div>
      <div className="course-module-tree">
        <div className="course-module-node module-title-button is-current">
          <strong>01 · Core language</strong>
          <span>2 of 4 blocks complete</span>
        </div>
        <div className="module-chapter is-current">
          <button disabled type="button">
            <i>01</i>
            <strong>Variables and functions</strong>
            <span>In progress</span>
          </button>
        </div>
        <div className="module-step-grid">
          <button className="module-step-tile is-theory" disabled type="button">
            <strong>Theory</strong><span>Values and names</span>
          </button>
          <button className="module-step-tile is-workshop is-current" disabled type="button">
            <strong>Workshop</strong><span>Find the next lesson</span>
          </button>
        </div>
      </div>
      <div className="file-panel-footer">
        <div className="file-panel-status">
          <span>Course progress</span>
          <strong>42% complete</strong>
          <small>Workspace synced</small>
        </div>
      </div>
    </StoneSurface>
  );
}

function HeroEditorPanel() {
  return (
    <section className="hero-workspace-editor-panel">
      <div className="editor-workspace-tabs" aria-hidden="true">
        <button className="is-active" disabled type="button">Code</button>
        <button disabled type="button">Output</button>
        <button disabled type="button">Terminal</button>
      </div>
      <div className="editor-shell is-code">
        <StoneEditor filePath="lesson.js" onChange={() => undefined} readOnly value={heroCode} />
      </div>
    </section>
  );
}

function HeroTutorPanel() {
  return (
    <StoneSurface as="aside" variant="card" className="hero-workspace-tutor-panel">
      <div className="lesson-panel ai-chat-panel">
        <div className="chat-canvas-head">
          <div className="lesson-progress-copy"><span>Step 3 / 7</span><span>42%</span></div>
          <div className="lesson-progress-track"><i style={{ width: "42%" }} /></div>
          <strong>Find the next unfinished lesson</strong>
        </div>
        <div className="ai-chat-scroll">
          <div className="ai-message assistant-message ai-response">
            <h2>Why use <code>find</code>?</h2>
            <p>It returns the first item that matches your condition. Here, that means the first lesson not completed yet.</p>
          </div>
          <div className="ai-message user-message"><p>So it stops after finding arrays?</p></div>
          <div className="ai-message assistant-message ai-response"><p>Exactly. Run the file and inspect the returned object.</p></div>
        </div>
        <div className="chat-dock">
          <div className="quick-action-label">Quick actions</div>
          <div className="reply-suggestions" aria-hidden="true">
            <button disabled type="button">Explain the callback</button>
            <button disabled type="button">Give me a hint</button>
          </div>
        </div>
      </div>
    </StoneSurface>
  );
}
