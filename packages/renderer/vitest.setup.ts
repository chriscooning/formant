// Tell React 19 that we're in an act() test environment
// This silences the "not configured to support act(...)" warnings
(globalThis as Record<string, unknown>).IS_REACT_ACT_ENVIRONMENT = true;
