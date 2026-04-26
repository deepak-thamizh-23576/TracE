<div class="app">

  <!-- LEFT SIDE -->
  <div class="left-section">
    {#each columns as col}
      <div class="column">
        <h3>{col}</h3>

        {#if col === "Exercise"}

          <div class="section">
            <div class="section-header">
              <h4>
                {currentExerciseType ? currentExerciseType : "Select Workout"}
              </h4>
            </div>

            {#each filteredItems.filter(i =>
              i.module === "Exercise" &&
              i.level === currentExerciseType
            ) as item}
              <div class="task-card">
                <div class="task-content">
                  <h2>{item.text}</h2>
                </div>
              </div>
                  {/each}
          </div>

        {:else}

          {#each modules[col].sections as section}
            <div class="section">
              <div class="section-header">
                <h4>{section}</h4>
                <button 
                  class="collapse-btn" 
                  on:click={() => toggleSection(col, section)}
                >
                  {collapsedSections[`${col}-${section}`] ? '+' : '−'}
                </button>
              </div>

              {#if !collapsedSections[`${col}-${section}`]}
              <!-- Task -->
              {#if col === "Task"}
                {#each filteredItems.filter(i =>
                  i.module === "Task" &&
                  ((section === "Pending" && i.status === "pending") ||
                  (section === "Completed" && i.status === "completed"))
                ) as item}

                  <div class="card-wrapper">
                    <div
                      class="task-card {expandedId === item.id ? 'expanded' : ''}"
                      on:click={() => toggleExpand(item.id)}
                    >
                      <div class="task-content">
                        <h2>{item.text}</h2>
                        {#if item.delays && item.delays.length > 0}
                          <span class="delay-badge">{item.delays.length} delay{item.delays.length > 1 ? 's' : ''}</span>
                        {/if}
                      </div>

                      <div class="task-actions">
                        <span class="priority {item.level}"></span>
                      </div>
                    </div>

                    {#if expandedId === item.id}
                      <div class="expanded-panel">
                        <!-- Delay History Thread -->
                        {#if item.delays && item.delays.length > 0}
                          <div class="delay-thread">
                            <div class="thread-title">Delay History</div>
                            {#each item.delays as delay, idx}
                              <div class="thread-entry">
                                <div class="thread-line-col">
                                  <div class="thread-dot"></div>
                                  {#if idx < item.delays.length - 1}
                                    <div class="thread-line"></div>
                                  {/if}
                                </div>
                                <div class="thread-content">
                                  <div class="thread-date">{delay.date}</div>
                                  {#if editingDelayId === delay.id}
                                    <div class="delay-card-editing">
                                      <input
                                        class="delay-edit-input"
                                        bind:value={editingDelayText}
                                        on:keydown={(e) => e.key === 'Enter' && saveDelayEdit(delay)}
                                      />
                                      <div class="edit-actions">
                                        <button class="edit-save-btn" on:click|stopPropagation={() => saveDelayEdit(delay)}>
                                          ✓ Save
                                        </button>
                                        <button class="edit-cancel-btn" on:click|stopPropagation={cancelDelayEdit}>
                                          ✕ Cancel
                                        </button>
                                      </div>
                                    </div>
                                  {:else}
                                    <div class="delay-card" on:click|stopPropagation={() => startDelayEdit(delay)}>
                                      <div class="delay-card-content">
                                        {#if delay.attachmentLink}
                                          <div class="attachment-thumb">
                                            <img src={delay.attachmentLink} alt="attachment" />
                                          </div>
                                        {/if}
                                        <span class="delay-reason">{delay.reason}</span>
                                        <button
                                          class="delay-delete-btn"
                                          on:click|stopPropagation={() => confirmDeleteDelay(delay, item)}
                                        >
                                          🗑
                                        </button>
                                      </div>
                                    </div>
                                  {/if}
                                </div>
                              </div>
                            {/each}
                          </div>
                        {/if}

                        <!-- New Delay Input -->
                        {#if item.status === "pending"}
                          <div class="delay-block">
                            <div class="delay-label-row">
                              <span class="delay-label">New Delay</span>
                              <span class="delay-label-date">{new Date().toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit', hour12: true })}</span>
                            </div>
                            <div class="delay-input-container">
                              <input
                                class="delay-input"
                                placeholder="Reason for delay"
                                bind:value={delayInputs[item.id]}
                                on:keydown={(e) => e.key === 'Enter' && addDelay(item)}
                              />
                            </div>
                          </div>
                        {/if}

                        <!-- Action Buttons -->
                        <div class="action-row">
                          {#if item.status === "pending"}
                            <button
                              class="action-btn-delay {delayInputs[item.id] ? 'save-mode' : ''}"
                              on:click|stopPropagation={() => delayInputs[item.id] ? addDelay(item) : null}
                            >
                              {delayInputs[item.id] ? 'Save' : 'Delay'}
                            </button>
                            <button
                              class="action-btn-complete"
                              on:click|stopPropagation={() => markComplete(item)}
                            >
                              Complete
                            </button>
                          {/if}
                          <button
                            class="action-btn-edit"
                            on:click|stopPropagation={() => startEdit(item)}
                          >
                            Edit
                          </button>
                        </div>
                      </div>
                    {/if}

                  </div>

                {/each}
              {/if}

              <!-- Food -->
              {#if col === "Food"}
                {#each filteredItems.filter(i =>
                  i.module === "Food" && i.level === section
                ) as item}
                  <div class="task-card">
                    <div class="task-content">
                      <h2>{item.text}</h2>
                    </div>
                  </div>
                {/each}
              {/if}

              <!-- Goal -->
              {#if col === "Goal"}
                {#each items.filter(i =>
                  i.module === "Goal" &&
                  ((section === "Pending" && i.status === "pending") ||
                  (section === "Completed" && i.status === "completed"))
                ) as item}

                  <div class="card-wrapper">
                    <div
                      class="task-card"
                      on:click={() => toggleExpand(item.id)}
                    >
                      <div class="task-content">
                        <h2>{item.text}</h2>
                      </div>

                      <div class="task-actions">
                        <span class="priority {item.level}"></span>
                      </div>
                    </div>

                    {#if expandedId === item.id}
                      <div class="action-card">
                        {#if item.status === "pending"}
                          <button
                            class="action-btn"
                            on:click|stopPropagation={() => markComplete(item)}
                          >
                            Complete
                          </button>
                        {/if}

                        <button
                          class="action-btn"
                          on:click|stopPropagation={() => startEdit(item)}
                        >
                          Edit
                        </button>
                      </div>
                    {/if}

                  </div>

                {/each}
              {/if}

              {/if}
            </div>
          {/each}

        {/if}


      </div>
    {/each}
  </div>

  <!-- RIGHT SIDE -->
  <div class="right-section">
    <h3>Calendar</h3>
    <div class="calendar-container">
      <div bind:this={calendarEl}></div>
    </div>
  </div>

  <!-- BOTTOM PANEL -->
  <div class="bottom-nav">

    <!-- LEVEL 3 : INPUT -->
    {#if activePanel && subSelection}
      <button on:click={resetToMain}>C</button>
      <button on:click={goBackToLevel2}>B</button>

      <input
        bind:value={inputValue}
        placeholder="{activePanel} - {subSelection}"
        style="border:none; outline:none; background:transparent; font-family: inherit"
      />

      <button disabled={!inputValue} on:click={uploadItem}>
        U
      </button>

    <!-- LEVEL 2 : SECTION OPTIONS -->
    {:else if activePanel}
      <button on:click={resetToMain}>Back</button>

      {#each modules[activePanel].options as option}
        <button on:click={() => subSelection = option}>
          {option}
        </button>
      {/each}

    <!-- LEVEL 1 : MODULE SELECTION -->
    {:else}
      {#each columns as col}
        <button on:click={() => activePanel = col}>
          {col}
        </button>
      {/each}
    {/if}

  </div>

</div>


<script>
  import flatpickr from "flatpickr";
  import "flatpickr/dist/flatpickr.min.css";
  import { onMount } from "svelte";

  // Dynamic API base URL based on environment
  // Local dev: catalyst serve exposes the function directly at port 3000
  // Deployed: same domain, use relative path through Catalyst proxy
  const isLocal = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
  const API_BASE = isLocal
    ? 'http://localhost:3000/server/track_everything_te_function'
    : '/server/track_everything_te_function';

  let items = [];
  let expandedId = null;
  let editingId = null;
  let editValue = "";
  let calendarEl;
  let selectedDate = null;
  let collapsedSections = {};  // Track collapsed sections

  // Delay state
  let delayInputs = {};         // { [taskId]: string } — per-task delay input
  let editingDelayId = null;    // ROWID of delay being edited
  let editingDelayText = "";

  /* ---------- MODULE CONFIG ---------- */

  let modules = {
    Task: {
      sections: ["Pending", "Completed"],
      options: ["High", "Medium", "Low"],
      type: "priority"
    },
    Food: {
      sections: ["Breakfast", "Lunch", "Dinner", "Snacks"],
      options: ["Breakfast", "Lunch", "Dinner", "Snacks"],
      type: "meal"
    },
    Exercise: {
      sections: [],   // no fixed sections
      options: ["Push", "Pull", "Leg", "Rest", "Cardio"],
      type: "dynamic-category"
    },
    Goal: {
      sections: ["Pending", "Completed"],
      options: ["High", "Medium", "Low"],
      type: "priority"
    }
  };

  let columns = Object.keys(modules);

  /* ---------- UI STATE ---------- */

  let activePanel = null;   // Level 1
  let subSelection = null;  // Level 2
  let inputValue = "";      // Level 3

  /* ---------- DATA STATE ---------- */

  let tasks = [];
  let foodItems = [];
  let currentExerciseType = null;
  let flatpickrInstance = null;

  // Get dates with pending tasks
  $: pendingTaskDates = items
    .filter(item => item.module === "Task" && item.status === "pending" && item.taskDate)
    .map(item => item.taskDate.split(' ')[0])  // Extract just YYYY-MM-DD
    .filter((date, index, self) => self.indexOf(date) === index); // unique dates

  // Refresh calendar when pending dates change
  $: if (flatpickrInstance && pendingTaskDates) {
    flatpickrInstance.redraw();
  }

  /* ---------- PANEL CONTROLS ---------- */

  function resetToMain() {
    activePanel = null;
    subSelection = null;
    inputValue = "";
  }

  function goBackToLevel2() {
    subSelection = null;
    inputValue = "";
  }

  function toggleExpand(id) {
    expandedId = expandedId === id ? null : id;
  }

  function toggleSection(col, section) {
    const key = `${col}-${section}`;
    collapsedSections[key] = !collapsedSections[key];
    collapsedSections = collapsedSections;  // Trigger reactivity
  }

  function startEdit(item) {
    editingId = item.id;
    editValue = item.text;
  }

  function cancelEdit() {
    editingId = null;
    editValue = "";
  }

  /* ---------- UPLOAD ---------- */

  async function uploadItem() {
    if (!inputValue) return;

    if (activePanel === "Exercise") {
      currentExerciseType = subSelection;
    }

    await fetch(`${API_BASE}/add`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        itemType: activePanel,
        itemTypeLevel: subSelection,
        itemContent: inputValue,
        status: modules[activePanel].type === "priority" ? "pending" : null,
        createdDate: selectedDate  // Send the selected calendar date
      })
    });

    inputValue = "";
    subSelection = null;

    await loadData(activePanel);
  }

  async function saveEdit(item) {
    if (!editValue) return;

    await fetch(`${API_BASE}/update`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        id: item.id,
        itemContent: editValue
      })
    });

    editingId = null;
    expandedId = null;

    await loadData(item.module);
  }

  async function markComplete(item) {
    await fetch(`${API_BASE}/updateStatus`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        id: item.id,
        status: "completed"
      })
    });

    expandedId = null;
    await loadData(item.module);
  }

  /* ---------- DELAY CRUD ---------- */

  async function loadDelays(taskId) {
    const res = await fetch(`${API_BASE}/listDelays?TaskRowId=${taskId}`);
    const data = await res.json();
    return data.map(row => ({
      id: row.ROWID,
      reason: row.delayInput,
      attachmentLink: row.attachmentLink,
      date: new Date(row.CREATEDTIME).toLocaleString('en-US', {
        month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit', hour12: true
      }),
      taskRowId: row.TaskRowID
    }));
  }

  async function loadAllDelaysForTasks() {
    const taskItems = items.filter(i => i.module === "Task");
    for (const item of taskItems) {
      item.delays = await loadDelays(item.id);
    }
    items = [...items]; // trigger reactivity
  }

  async function addDelay(item) {
    const reason = delayInputs[item.id];
    if (!reason || !reason.trim()) return;

    await fetch(`${API_BASE}/addDelay`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        taskRowId: item.id,
        delayInput: reason.trim(),
        attachmentLink: null
      })
    });

    delayInputs[item.id] = "";
    delayInputs = { ...delayInputs }; // trigger reactivity
    item.delays = await loadDelays(item.id);
    items = [...items];
  }

  function startDelayEdit(delay) {
    editingDelayId = delay.id;
    editingDelayText = delay.reason;
  }

  function cancelDelayEdit() {
    editingDelayId = null;
    editingDelayText = "";
  }

  async function saveDelayEdit(delay) {
    if (!editingDelayText.trim()) return;

    await fetch(`${API_BASE}/updateDelay`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        id: delay.id,
        delayInput: editingDelayText.trim()
      })
    });

    editingDelayId = null;
    editingDelayText = "";

    // Refresh delays for this task
    const taskItem = items.find(i => i.id === delay.taskRowId);
    if (taskItem) {
      taskItem.delays = await loadDelays(taskItem.id);
      items = [...items];
    }
  }

  async function confirmDeleteDelay(delay, item) {
    if (!confirm("Delete this delay entry?")) return;

    await fetch(`${API_BASE}/deleteDelay`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: delay.id })
    });

    item.delays = await loadDelays(item.id);
    items = [...items];
  }



  /* ---------- LOAD DATA ---------- */

    async function loadData(type) {
      const res = await fetch(
        `${API_BASE}/list?itemType=${type}`
      );

      const data = await res.json();

      const formatted = data.map(row => ({
        id: row.ROWID,
        module: row.itemType,
        level: row.itemTypeLevel,
        text: row.itemContent,
        status: row.status,
        createdAt: row.CREATEDTIME,
        taskDate: row.taskDate,  // Custom date field
        delays: []               // Will be populated for Tasks
      }));

      items = [...items.filter(i => i.module !== type), ...formatted];

      // Load delays for Task items
      if (type === "Task") {
        for (const item of formatted) {
          item.delays = await loadDelays(item.id);
        }
        items = [...items];
      }

      if (type === "Exercise" && formatted.length > 0) {
        currentExerciseType = formatted[formatted.length - 1].level;
      }
    }

    // Filter items by selected date
    function filterByDate(itemsList) {
      // Access selectedDate to create reactive dependency
      const currentDate = selectedDate;
      if (!currentDate) return itemsList;
      return itemsList.filter(item => {
        if (!item.createdAt) return false;
        const itemDate = item.createdAt.split(' ')[0]; // Extract "YYYY-MM-DD" from "YYYY-MM-DD HH:MM:SS:ms"
        return itemDate === currentDate;
      });
    }

    // Reactive filtered items
    $: filteredItems = selectedDate 
      ? items.filter(item => {
          if (!item.taskDate) return false;
          // Extract just the date part (YYYY-MM-DD) from taskDate
          const itemDate = item.taskDate.split(' ')[0];
          return itemDate === selectedDate;
        })
      : items;


  /* ---------- INITIAL LOAD ---------- */

  // Moved to onMount to ensure selectedDate is set first

  /* ---------- CALENDAR INIT ---------- */

  onMount(async () => {

    // Set selectedDate to today on load
    const today = new Date();
    const year = today.getFullYear();
    const month = String(today.getMonth() + 1).padStart(2, '0');
    const day = String(today.getDate()).padStart(2, '0');
    selectedDate = `${year}-${month}-${day}`;

    // Load data from backend
    await Promise.all(columns.map(col => loadData(col)));

    flatpickrInstance = flatpickr(calendarEl, {
      inline: true,
      dateFormat: "Y-m-d",
      defaultDate: new Date(),
      onChange: (selectedDates, dateStr) => {
        selectedDate = dateStr;
      },
      onDayCreate: (dObj, dStr, fp, dayElem) => {
        const dateStr = dayElem.dateObj.getFullYear() + '-' + 
          String(dayElem.dateObj.getMonth() + 1).padStart(2, '0') + '-' + 
          String(dayElem.dateObj.getDate()).padStart(2, '0');
        
        if (pendingTaskDates.includes(dateStr)) {
          dayElem.classList.add('has-pending');
        }
      }
    });
  });
</script>