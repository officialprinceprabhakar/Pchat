#====================================================================================================
# START - Testing Protocol - DO NOT EDIT OR REMOVE THIS SECTION
#====================================================================================================

# THIS SECTION CONTAINS CRITICAL TESTING INSTRUCTIONS FOR BOTH AGENTS
# BOTH MAIN_AGENT AND TESTING_AGENT MUST PRESERVE THIS ENTIRE BLOCK

# Communication Protocol:
# If the `testing_agent` is available, main agent should delegate all testing tasks to it.
#
# You have access to a file called `test_result.md`. This file contains the complete testing state
# and history, and is the primary means of communication between main and the testing agent.
#
# Main and testing agents must follow this exact format to maintain testing data. 
# The testing data must be entered in yaml format Below is the data structure:
# 
## user_problem_statement: {problem_statement}
## backend:
##   - task: "Task name"
##     implemented: true
##     working: true  # or false or "NA"
##     file: "file_path.py"
##     stuck_count: 0
##     priority: "high"  # or "medium" or "low"
##     needs_retesting: false
##     status_history:
##         -working: true  # or false or "NA"
##         -agent: "main"  # or "testing" or "user"
##         -comment: "Detailed comment about status"
##
## frontend:
##   - task: "Task name"
##     implemented: true
##     working: true  # or false or "NA"
##     file: "file_path.js"
##     stuck_count: 0
##     priority: "high"  # or "medium" or "low"
##     needs_retesting: false
##     status_history:
##         -working: true  # or false or "NA"
##         -agent: "main"  # or "testing" or "user"
##         -comment: "Detailed comment about status"
##
## metadata:
##   created_by: "main_agent"
##   version: "1.0"
##   test_sequence: 0
##   run_ui: false
##
## test_plan:
##   current_focus:
##     - "Task name 1"
##     - "Task name 2"
##   stuck_tasks:
##     - "Task name with persistent issues"
##   test_all: false
##   test_priority: "high_first"  # or "sequential" or "stuck_first"
##
## agent_communication:
##     -agent: "main"  # or "testing" or "user"
##     -message: "Communication message between agents"

# Protocol Guidelines for Main agent
#
# 1. Update Test Result File Before Testing:
#    - Main agent must always update the `test_result.md` file before calling the testing agent
#    - Add implementation details to the status_history
#    - Set `needs_retesting` to true for tasks that need testing
#    - Update the `test_plan` section to guide testing priorities
#    - Add a message to `agent_communication` explaining what you've done
#
# 2. Incorporate User Feedback:
#    - When a user provides feedback that something is or isn't working, add this information to the relevant task's status_history
#    - Update the working status based on user feedback
#    - If a user reports an issue with a task that was marked as working, increment the stuck_count
#    - Whenever user reports issue in the app, if we have testing agent and task_result.md file so find the appropriate task for that and append in status_history of that task to contain the user concern and problem as well 
#
# 3. Track Stuck Tasks:
#    - Monitor which tasks have high stuck_count values or where you are fixing same issue again and again, analyze that when you read task_result.md
#    - For persistent issues, use websearch tool to find solutions
#    - Pay special attention to tasks in the stuck_tasks list
#    - When you fix an issue with a stuck task, don't reset the stuck_count until the testing agent confirms it's working
#
# 4. Provide Context to Testing Agent:
#    - When calling the testing agent, provide clear instructions about:
#      - Which tasks need testing (reference the test_plan)
#      - Any authentication details or configuration needed
#      - Specific test scenarios to focus on
#      - Any known issues or edge cases to verify
#
# 5. Call the testing agent with specific instructions referring to test_result.md
#
# IMPORTANT: Main agent must ALWAYS update test_result.md BEFORE calling the testing agent, as it relies on this file to understand what to test next.

#====================================================================================================
# END - Testing Protocol - DO NOT EDIT OR REMOVE THIS SECTION
#====================================================================================================



#====================================================================================================
# Testing Data - Main Agent and testing sub agent both should log testing data below this section
#====================================================================================================

user_problem_statement: |
  PChat is a premium Android social chat app with Y99-inspired room UI. This session:
  1) Fix the frontend crash (previous session showed timeout on tab-home).
  2) Verify existing UI polish: cleaned room header (3-dot menu), grouped members by role, change-password flow for seeded devs.
  3) Build a complete hidden Developer Dashboard with:
     - Overview stats (users, rooms, messages, posts, reports, banned users)
     - Growth analytics (24h/7d)
     - User management (search, ban/unban, force logout, reset password, delete, badges)
     - Reports queue
     - Badges CRUD
     - Feature toggles (posts, voice notes, room creation, guest signup, Google auth, friends, DM, profanity filter)
     - Global announcements popup (severity: info/warning/critical, TTL, dismissible per user)
     - Mod logs
  4) Change password flow enforced for seeded developer accounts: Prince_Prabhakar, PrincePrabhakar, Reyansh.

backend:
  - task: "Force change-password flow for seeded developers"
    implemented: true
    working: true
    file: "/app/backend/server.py"
    stuck_count: 0
    priority: "high"
    needs_retesting: false
    status_history:
      - working: true
        agent: "main"
        comment: "Seed logic sets must_change_password=True. Login returns user.must_change_password=true. change-password endpoint allows omitting current_password when must_change=true, then clears the flag."

  - task: "Dev feature flags GET/POST"
    implemented: true
    working: true
    file: "/app/backend/server.py"
    stuck_count: 0
    priority: "high"
    needs_retesting: true
    status_history:
      - working: true
        agent: "main"
        comment: "Added /api/features (any user), /api/dev/features (dev), /api/dev/features POST with 8 known keys and default fallback."

  - task: "Global announcement CRUD + active + dismiss"
    implemented: true
    working: true
    file: "/app/backend/server.py"
    stuck_count: 0
    priority: "high"
    needs_retesting: true
    status_history:
      - working: true
        agent: "main"
        comment: "Added POST /api/dev/announcements (creates ann + broadcasts notifications+push), GET /api/dev/announcements, POST /api/dev/announcements/{id}/deactivate, GET /api/announcements/active (per-user, honors dismissed_by), POST /api/announcements/{id}/dismiss."

  - task: "Dev user actions: force-logout, reset-password"
    implemented: true
    working: true
    file: "/app/backend/server.py"
    stuck_count: 0
    priority: "medium"
    needs_retesting: true
    status_history:
      - working: true
        agent: "main"
        comment: "POST /api/dev/user/{user_id}/logout-all deletes all sessions. POST /api/dev/user/{user_id}/reset-password sets temp PRin09#@ and must_change_password=True. Both logged to mod_logs."

frontend:
  - task: "Fix frontend load crash on tab-home"
    implemented: true
    working: true
    file: "/app/frontend/app/(tabs)/_layout.tsx"
    stuck_count: 0
    priority: "high"
    needs_retesting: false
    status_history:
      - working: true
        agent: "main"
        comment: "Removed stale Tabs.Screen name='discover' (no file existed). Added defensive redirect to /change-password if user.must_change_password. Verified via screenshot; testuser1 lands on Home and Prince_Prabhakar lands on Change-Password."

  - task: "Enhanced Developer Dashboard"
    implemented: true
    working: true
    file: "/app/frontend/app/dev/index.tsx"
    stuck_count: 0
    priority: "high"
    needs_retesting: true
    status_history:
      - working: true
        agent: "main"
        comment: "Rebuilt with 7 sections (Overview, Users, Reports, Badges, Toggles, Announce, Mod Logs). Uses horizontal ScrollView tabs. Overview surfaces both devStats and devAnalytics. User modal shows friends/rooms/posts/messages/sessions and supports ban, force-logout, reset-password, delete, badge assign/remove."

  - task: "Global Announcement popup"
    implemented: true
    working: true
    file: "/app/frontend/src/components/AnnouncementPopup.tsx"
    stuck_count: 0
    priority: "high"
    needs_retesting: true
    status_history:
      - working: true
        agent: "main"
        comment: "Popup fetches /api/announcements/active on mount + every 60s. Severity-styled icon (info/warning/critical). Optional action_url button. Dismiss calls backend and hides. Rendered inside (tabs) layout so any logged-in user sees it."

metadata:
  created_by: "main_agent"
  version: "1.0"
  test_sequence: 1
  run_ui: false

test_plan:
  current_focus:
    - "Force change-password flow for seeded developers"
    - "Dev feature flags GET/POST"
    - "Global announcement CRUD + active + dismiss"
    - "Dev user actions: force-logout, reset-password"
  stuck_tasks: []
  test_all: false
  test_priority: "high_first"

agent_communication:
  - agent: "main"
    message: |
      Session complete. Fixed the frontend crash (stale Tabs.Screen name=discover) and defensive change-password redirect in tabs layout. Extended backend with feature flags, announcements CRUD, force-logout, reset-password. Rebuilt Dev Dashboard as a 7-section experience with per-user modal actions. Added AnnouncementPopup that any logged-in user sees automatically.

      Please test:
      1) POST /api/auth/guest/login for Prince_Prabhakar with PRin09#@ — expect user.must_change_password=true.
      2) After change-password (no current_password when forced), /api/auth/me returns must_change_password=false.
      3) GET /api/features (any user), /api/dev/features (dev only, 8 keys, default fallback), POST /api/dev/features toggling posts_enabled true/false.
      4) POST /api/dev/announcements with title/message/severity. GET /api/announcements/active returns it. After POST /api/announcements/{id}/dismiss for a user, subsequent /active returns null.
      5) POST /api/dev/user/{user_id}/logout-all deletes sessions (login another user first).
      6) POST /api/dev/user/{user_id}/reset-password sets must_change_password=true and returns temp password.
      7) UI: seeded dev login → forced /change-password → after set → lands on /home; dev can navigate Profile → dev crown → dashboard.
      Non-dev users: GET /api/dev/* returns 403.

      Seeded dev credentials:
      - Prince_Prabhakar / DevPass123!  (already went through change-password during session verification)
      - PrincePrabhakar / PRin09#@ (still must_change=true)
      - Reyansh / PRin09#@ (still must_change=true)
      Regular test user: testuser1 / testpass123
