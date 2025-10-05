# Product Requirements Document
## Geometry Dash-Inspired Game

---

### Overview

A fully-featured 2D rhythm-based platformer similar to Geometry Dash, with cube, wave, ship, and ball modes, comprehensive level editor, custom level management system, practice mode, analytics, tutorial system, and leaderboards.

---

### Core Game Modes

- **Cube Mode:** Classic jump-over-obstacles mechanic with ground-based movement
- **Wave Mode:** Continuous diagonal movement with toggle direction control
- **Ship Mode:** Flight mode with hold-to-rise, release-to-fall mechanics
- **Ball Mode:** Gravity-flip mode to navigate between ground/ceiling surfaces
- **Mixed Mode:** Seamless transitions between all modes via portals

---

### Game Controls

- **Primary Input:** Space, Up Arrow, Mouse Click, or Touch
- **Practice Mode Shortcuts:**
  - Z key: Place checkpoint
  - X key: Delete checkpoint
- **Escape:** Close menus
- **Visual & Audio Feedback:** Sound effects for jumps, deaths, and background music

---

### User Interface

#### Main Menu (Game Hub)
- Play Geometry Dash
- Open Level Editor
- Gradient background with card-based navigation

#### In-Game HUD
- Current level display
- Score counter
- Attempt counter
- Multiple control buttons (Start, Pause, Practice, Auto Play, etc.)

#### Game Controls Panel
- Level selector dropdown (1-5, Developer's Challenge, Impossible Level, Custom Levels)
- Game mode selector (Mixed, Cube, Wave, Ship, Ball)
- Speed control slider (0.25x - 2x with 0.25x increments)
- Volume control slider (0-100%)
- Action buttons array

---

### Core Features

#### 1. Speed Control System
- Speed range: 0.25x to 2.0x
- Increment step: 0.25x
- Real-time speed adjustment during gameplay
- Visual speed indicator showing current multiplier

#### 2. Custom Level System
- **Unlimited Named Projects:** Store multiple custom levels with unique names
- **Project Management:** Save, load, rename, and delete level projects
- **Level Upload System:** Import custom levels from editor
- **User Levels Page:** Browse and manage all uploaded custom levels
- **Level Metadata:**
  - Level name
  - Difficulty rating (1-5 stars)
  - Date added
  - Custom sorting (by date, name, rating, difficulty)

#### 3. Owner Code Bypass
- Special access codes for level creators
- Bypass system for testing and verification

#### 4. Level Editor
- **Tools:**
  - Select tool for object manipulation
  - Place tool for adding obstacles/portals
  - Delete tool for removing objects
- **Obstacle Types:**
  - Spikes
  - Platforms
  - Jump Pads (launch player upward)
  - Wall Top/Bottom
  - Slope Up/Down (45° angles)
  - Steep Up/Down (steeper angles)
- **Portal Types:**
  - Game mode portals (Cube, Wave, Ship, Ball)
  - Finish portal
- **Editor Properties:**
  - Grid snap toggle
  - Adjustable grid size (10-50px)
  - Object width/height customization
  - Rotation controls (0-359°, 15° increments)
  - Zoom controls with percentage display
  - Camera panning
- **Level Management:**
  - Save level to JSON
  - Load level from JSON
  - Play test functionality
  - Clear all objects
  - Real-time object count and level length display

#### 5. Built-in Levels
- **Level 1:** Easy difficulty
- **Level 2:** Medium difficulty
- **Level 3:** Hard difficulty
- **Level 4:** Expert difficulty
- **Level 5:** Insane difficulty
- **Developer's Challenge:** Expert-level custom design
- **Impossible Level:** Ultimate difficulty with warning system

#### 6. Practice Mode
- Toggle on/off before or during gameplay
- Checkpoint placement system (Z key)
- Checkpoint deletion (X key)
- Visual checkpoint markers
- Resume from last checkpoint on death
- Does not affect leaderboard statistics

#### 7. Show Hitboxes
- Toggle visual hitbox outlines
- Separate player and obstacle hitbox visualization
- Forgiving hitbox system:
  - Player hitbox: 4px smaller on each side
  - Obstacle hitbox: 3px smaller on each side

#### 8. Auto Play Mode
- AI-controlled gameplay
- Automatic jump timing based on intervals
- Toggle on/off during gameplay

#### 9. Interactive Tutorial System
- **Tutorial Overlay:** Step-by-step guided experience
- **Progress Tracking:** Visual progress bar and step counter
- **Tutorial Steps:** Multiple interactive lessons
- **Tutorial Completion Persistence:** Saves progress to localStorage
- **Skip Option:** Can skip tutorial at any time
- **Features Covered:**
  - Basic controls
  - Game modes explanation
  - Portal mechanics
  - Practice mode usage

#### 10. Comprehensive Help Menu
- **Game Objective Section**
- **Controls Guide:**
  - Detailed input mappings for all modes
  - Hold vs tap mechanics explanation
- **Game Modes Section:**
  - Cube, Ship, Wave, Ball, and Mixed mode descriptions
  - Visual indicators for each mode
- **Features Documentation:**
  - Practice Mode
  - Auto Play
  - Speed Control
  - Show Hitboxes
  - Level Editor access
- **Levels Information:**
  - Difficulty progression overview
  - Special level descriptions

#### 11. Leaderboard System
- **Player Identification:** Customizable player names
- **Score Tracking:** Stores completion data with timestamps
- **Filtering Options:**
  - By level (All, 1-5, Developer, Impossible, Custom)
  - By game mode (All, Cube, Ship, Wave, Ball, Mixed)
  - By sort criteria (Score, Attempts, Time, Date)
- **Statistics Displayed:**
  - Final score
  - Number of attempts
  - Completion time
  - Date achieved
  - Game mode used
- **Data Management:**
  - Change player name
  - Clear leaderboard data
  - Persistent storage via localStorage

#### 12. Failure Analytics System
- **Session Tracking:**
  - Total deaths counter
  - Per-level death statistics
  - Failure hotspot identification
  - Time spent on level sections
  - Input pattern analysis
- **Pattern Recognition:**
  - Early jump detection
  - Late reaction identification
  - Mode transition errors
  - Timing issues tracking
  - Gravity confusion monitoring
- **Smart Suggestions:**
  - Context-aware tips based on failure patterns
  - Cooldown system (10 seconds between suggestions)
  - Suggestion counter
- **Analytics Dashboard:**
  - Total deaths display
  - Most common issue identification
  - Current level death count
  - Suggestions given counter
  - Failure hotspots list with position tracking
- **Data Management:**
  - Reset analytics
  - Export analytics data
  - Persistent storage

#### 13. Warning System
- Modal warnings for challenging levels
- Continue/Cancel options
- Used for Impossible Level and other special content

---

### Technical Features

#### Audio System
- Web Audio API implementation
- Procedurally generated sound effects:
  - Jump sound (800Hz beep)
  - Death sound (200Hz beep)
  - Background music (procedural note sequences)
- Volume control (0-100%)
- Audio context state management

#### Rendering System
- Canvas-based 2D rendering
- 60 FPS target frame rate
- Delta time calculation for smooth movement
- Camera system for scrolling levels
- Particle effects system
- Trail effects for player movement
- Persistent wave trail visualization

#### Collision Detection
- Pixel-perfect hitbox system with forgiveness offsets
- Rotation-aware collision for angled obstacles
- Separate collision handling per game mode
- Jump pad detection and boost mechanics

#### Storage System
- localStorage for:
  - Custom level projects (unlimited named projects)
  - Uploaded custom levels
  - Leaderboard data
  - Tutorial progress
  - Analytics data
  - Player preferences
  - Owner codes

#### Responsive Design
- Mobile touch controls
- Desktop mouse/keyboard controls
- Prevents default touch behaviors for smooth mobile play
- Viewport scaling considerations

---

### Quality and Accessibility

- **Cross-Platform:** Desktop and mobile browser support
- **Touch Controls:** Full mobile touchscreen support
- **Keyboard Controls:** Space, Arrow keys, Z, X, Escape
- **Mouse Controls:** Click-to-jump, drag-to-pan in editor
- **Visual Feedback:** Clear indicators for all game states
- **Audio Controls:** Adjustable volume with complete mute option
- **Difficulty Progression:** Gradual learning curve from Easy to Impossible
- **Practice Tools:** Checkpoints, hitboxes, speed adjustment for accessibility

---

### Level Design Features

#### Obstacle Variety
- Static spikes
- Platforms of various sizes
- Jump pads (boost mechanics)
- Walls (top and bottom)
- Slopes (45° angles)
- Steep slopes (steeper angles)
- Rotatable obstacles

#### Portal System
- Mode-switching portals (Cube/Wave/Ship/Ball)
- Speed portals (0.5x - 2.0x multipliers)
- Finish portals (level completion triggers)

#### Dynamic Elements
- Moving obstacles (in developer levels)
- Rotation animations
- Particle effects on collisions

---

### Game Progression

- 5 standard difficulty levels (Easy → Insane)
- 2 special challenge levels (Developer's Challenge, Impossible Level)
- Unlimited custom levels support
- Score-based progression tracking
- Attempt counter per session
- Leaderboard rankings

---

### Out-of-Scope

- Multiplayer/competitive races
- Microtransactions
- Online level sharing (currently local storage only)
- Account system/cloud saves
- Level ratings/community voting
- Achievements/badges system
- Daily challenges

---

### Future Considerations

- Online level repository and sharing
- User accounts with cloud sync
- Community level ratings and comments
- More obstacle types and mechanics
- Additional game modes
- Achievement system
- Level verification system
- Replays and ghost runs
