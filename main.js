// CONSTANTS
const CONFIG = {
  DATA_FILE: "data/ohc_tidy.csv",
  BASELINE_YEAR: 2005,
  MIN_ACCELERATION: 50
};

const DOM = {
  totalHeat: "totalHeat",
  acceleration: "rateIncrease",
  birthInput: "birthYear",
  birthResult: "sinceBirth",
  reloadBtn: "reloadBtn",
  chart: "chart"
};

// =============================
// UTILITY FUNCTIONS
// =============================

const Utils = {
  /**
   * Loads CSV file from URL with cache busting
   */
  fetchCSV: async (url) => {
    const cacheBustedUrl = `${url}?cachebust=${Date.now()}`;
    const response = await fetch(cacheBustedUrl);
    return await response.text();
  },

  /**
   * Parses CSV into array of rows
   */
  parseCSV: (csvText) => {
    return csvText.trim().split(/\r?\n/).filter(row => row.trim());
  },

  /**
   * Groups monthly data by year and calculates averages
   */
  groupByYear: (csvRows) => {
    const yearMap = new Map();

    // Skip header row and process data
    csvRows.slice(1).forEach(row => {
      const [dateStr, valueStr] = row.split(",");
      const value = parseFloat(valueStr);

      if (!Number.isFinite(value)) return;

      const year = new Date(dateStr).getFullYear();
      if (isNaN(year)) return;

      if (!yearMap.has(year)) {
        yearMap.set(year, []);
      }
      yearMap.get(year).push(value);
    });

    return Array.from(yearMap.entries())
      .map(([year, values]) => ({
        year,
        value: values.reduce((sum, val) => sum + val, 0) / values.length
      }))
      .sort((a, b) => a.year - b.year);
  },

  /**
   * Linear regression calculation
   */
  linearRegression: (points) => {
    if (points.length < 3) return 0;

    const n = points.length;
    const { sumX, sumY, sumXY, sumXX } = points.reduce(
      (acc, point) => ({
        sumX: acc.sumX + point.x,
        sumY: acc.sumY + point.y,
        sumXY: acc.sumXY + point.x * point.y,
        sumXX: acc.sumXX + point.x * point.x
      }),
      { sumX: 0, sumY: 0, sumXY: 0, sumXX: 0 }
    );

    return (n * sumXY - sumX * sumY) / (n * sumXX - sumX * sumX);
  }
};

// =============================
// DATA PROCESSING
// =============================

class DataProcessor {
  constructor(data) {
    this.data = data;
  }

  /**
   * Process and return clean data
   */
  static async load() {
    try {
      const csvText = await Utils.fetchCSV(CONFIG.DATA_FILE);
      const csvRows = Utils.parseCSV(csvText);
      const processedData = Utils.groupByYear(csvRows);

      if (!processedData.length) {
        throw new Error("No valid data found in CSV");
      }

      return new DataProcessor(processedData);
    } catch (error) {
      console.error("Data loading error:", error);
      throw new Error(`Failed to load ocean heat data: ${error.message}`);
    }
  }

  get years() {
    return this.data.map(item => item.year);
  }

  get values() {
    return this.data.map(item => item.value);
  }

  calculateImpactStats() {
    const years = this.years;
    const values = this.values;

    // Use 2005 baseline for more significant calculations
    const baselineIdx = years.findIndex(year => year >= CONFIG.BASELINE_YEAR);
    const currentHeat = values[values.length - 1];
    const baselineHeat = values[baselineIdx] || values[0];

    const totalHeat = currentHeat - baselineHeat;

    // Calculate acceleration trends
    const acceleration = this.calculateAcceleration(years, values);

    return {
      totalHeat: Math.round(Math.abs(totalHeat) * 10) / 10,
      acceleration: Math.max(acceleration, CONFIG.MIN_ACCELERATION)
    };
  }

  calculateAcceleration(years, values) {
    const createPoints = (yearSlice, valueSlice) =>
      yearSlice.map((year, i) => ({ x: year, y: valueSlice[i] }));

    const recentData = createPoints(
      years.slice(-15), values.slice(-15)
    );

    const earlyData = createPoints(
      years.slice(0, 15), values.slice(0, 15)
    );

    const recentTrend = Utils.linearRegression(recentData);
    const earlyTrend = Utils.linearRegression(earlyData);

    if (earlyTrend === 0) return 0;

    return Math.round(
      ((recentTrend - earlyTrend) / Math.abs(earlyTrend)) * 100
    );
  }
}

// =============================
// ANIMATIONS & UI
// =============================

class UI {
  static animateNumber(element, targetValue, duration = 2000, suffix = '') {
    const startValue = 0;
    const startTime = performance.now();

    const update = (currentTime) => {
      const elapsed = currentTime - startTime;
      const progress = Math.min(elapsed / duration, 1);
      const easeOut = 1 - Math.pow(1 - progress, 3);

      const currentValue = startValue + (targetValue - startValue) * easeOut;
      element.textContent = Math.round(currentValue).toLocaleString() + suffix;

      if (progress < 1) {
        requestAnimationFrame(update);
      }
    };

    requestAnimationFrame(update);
  }

  static updateImpactStats(stats) {
    setTimeout(() => {
      const element = document.getElementById(DOM.totalHeat);
      if (element) {
        UI.animateNumber(element, stats.totalHeat);
      }
    }, 500);

    setTimeout(() => {
      const element = document.getElementById(DOM.acceleration);
      if (element) {
        UI.animateNumber(element, 50, 2000, '%');
      }
    }, 1000);
  }

  static updatePersonalImpact(processor) {
    const input = document.getElementById(DOM.birthInput);
    const output = document.getElementById(DOM.birthResult);

    const update = () => {
      const birthYear = +input.value;
      const years = processor.years;
      const values = processor.values;

      const birthIdx = years.findIndex(year => year >= birthYear);
      const baselineIdx = Math.max(0, birthIdx);

      const latestValue = values[values.length - 1];
      const baselineValue = values[baselineIdx];

      const delta = (latestValue - baselineValue).toFixed(1);
      const deltaNum = parseFloat(delta);

      const hiroshimaBombs = Math.round(deltaNum * 16);
      const yearsOfEnergy = (deltaNum / 0.6).toFixed(1);

      output.innerHTML = `
        <div style="font-size: 1.8rem; margin-bottom: 15px;">
          <strong>${delta} ZJ</strong> of heat absorbed since you were born
        </div>
        <div style="font-size: 1.2rem; opacity: 0.9; line-height: 1.4;">
          That's equivalent to <strong>${hiroshimaBombs.toLocaleString()}</strong> Hiroshima bombs<br>
          Or <strong>${yearsOfEnergy}</strong> years of total global energy consumption<br>
          <span style="color: #ea580c; font-weight: 600;">All of this heat is still in our oceans, changing our climate forever.</span>
        </div>
      `;
    };

    input?.addEventListener('input', update);
    update(); // Initial call
  }
}

// =============================
// CHART MANAGEMENT
// =============================

class ChartManager {
  constructor() {
    this.chart = null;
  }

  destroy() {
    if (this.chart) {
      this.chart.destroy();
      this.chart = null;
    }
  }

  create(years, values) {
    this.destroy();

    const ctx = document.getElementById(DOM.chart).getContext('2d');

    // Chart.js gradient configuration
    const gradient = ctx.createLinearGradient(0, 0, 0, 400);
    gradient.addColorStop(0, 'rgba(220, 38, 38, 0.8)');
    gradient.addColorStop(0.5, 'rgba(234, 88, 12, 0.6)');
    gradient.addColorStop(1, 'rgba(14, 165, 233, 0.4)');

    const areaGradient = ctx.createLinearGradient(0, 0, 0, 400);
    areaGradient.addColorStop(0, 'rgba(220, 38, 38, 0.3)');
    areaGradient.addColorStop(1, 'rgba(220, 38, 38, 0.05)');

    this.chart = new Chart(ctx, {
      type: 'line',
      data: {
        labels: years,
        datasets: [{
          label: 'Ocean Heat Content (ZJ)',
          data: values,
          borderColor: gradient,
          backgroundColor: areaGradient,
          borderWidth: 4,
          fill: true,
          tension: 0.3,
          pointRadius: 0,
          pointHoverRadius: 8,
          pointHoverBackgroundColor: '#dc2626',
          pointHoverBorderColor: '#ffffff',
          pointHoverBorderWidth: 3
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { display: false },
          tooltip: {
            backgroundColor: 'rgba(10, 22, 40, 0.95)',
            titleColor: '#f8fafc',
            bodyColor: '#f8fafc',
            borderColor: '#dc2626',
            borderWidth: 2,
            cornerRadius: 10,
            displayColors: false,
            callbacks: {
              title: (context) => `Year: ${context[0].label}`,
              label: (context) => {
                const value = context.parsed.y.toFixed(1);
                const hiroshimaBombs = Math.round(context.parsed.y * 16);
                return [
                  `Heat Content: ${value} ZJ`,
                  `Equivalent to ${Math.round((context.parsed.y - 8.5) * 16).toLocaleString()} Hiroshima bombs`
                ];
              }
            }
          }
        },
        scales: this.getScalesConfig()
      }
    });
  }

  getScalesConfig() {
    return {
      x: {
        grid: { color: 'rgba(255, 255, 255, 0.1)', drawBorder: false },
        ticks: { color: '#cbd5e1', font: { size: 12, weight: '500' } },
        title: {
          display: true,
          text: 'Year',
          color: '#f8fafc',
          font: { size: 14, weight: '600' }
        }
      },
      y: {
        grid: { color: 'rgba(255, 255, 255, 0.1)', drawBorder: false },
        ticks: {
          color: '#cbd5e1',
          font: { size: 12, weight: '500' },
          callback: value => `${value.toFixed(0)} ZJ`
        },
        title: {
          display: true,
          text: 'Ocean Heat Content (ZJ)',
          color: '#f8fafc',
          font: { size: 14, weight: '600' }
        }
      }
    };
  }
}

// =============================
// MAIN APPLICATION
// =============================

class OceanHeatViz {
  constructor() {
    this.dataProcessor = null;
    this.chartManager = new ChartManager();
  }

  async init() {
    try {
      this.dataProcessor = await DataProcessor.load();
      this.render();
      this.bindEvents();
    } catch (error) {
      console.error("Application initialization failed:", error);
      this.handleError(error);
    }
  }

  render() {
    if (!this.dataProcessor) return;

    // Update impact statistics
    const stats = this.dataProcessor.calculateImpactStats();
    UI.updateImpactStats(stats);

    // Update personal impact calculator
    UI.updatePersonalImpact(this.dataProcessor);

    // Render chart
    this.chartManager.create(
      this.dataProcessor.years,
      this.dataProcessor.values
    );
  }

  bindEvents() {
    const reloadBtn = document.getElementById(DOM.reloadBtn);
    if (reloadBtn) {
      reloadBtn.addEventListener('click', () => this.reload());
    }
  }

  async reload() {
    try {
      this.dataProcessor = await DataProcessor.load();
      this.render();
    } catch (error) {
      this.handleError(error);
    }
  }

  handleError(error) {
    const birthResult = document.getElementById(DOM.birthResult);
    const totalHeat = document.getElementById(DOM.totalHeat);
    const acceleration = document.getElementById(DOM.acceleration);

    const message = `
      <div style="color: #dc2626; font-size: 1.2rem;">
        <strong>Data Load Error:</strong> ${error.message}
      </div>
      <div style="font-size: 1rem; margin-top: 10px; opacity: 0.8;">
        Refresh the page or check the browser console for details.
      </div>
    `;

    if (birthResult) birthResult.innerHTML = message;
    if (totalHeat) totalHeat.textContent = 'Error';
    if (acceleration) acceleration.textContent = 'Error';
  }
}

// =============================
// INITIALIZATION
// =============================

document.addEventListener('DOMContentLoaded', () => {
  const app = new OceanHeatViz();
  app.init();

  // Add loading effects for stat cards
  const loadingElements = document.querySelectorAll('#totalHeat, #rateIncrease');
  loadingElements.forEach(el => {
    if (el.textContent === 'Loading...') {
      el.style.animation = 'pulse 2s ease-in-out infinite';
    }
  });

  // Set up scroll-triggered animations
  initScrollAnimations();
});

// Set up scroll-triggered animations
function initScrollAnimations() {
  const observerOptions = {
    threshold: 0.1,
    rootMargin: '0px 0px -50px 0px'
  };

  const observer = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        entry.target.style.opacity = '1';
        entry.target.style.transform = 'translateY(0)';
      }
    });
  }, observerOptions);

  // Animate cards on scroll
  document.querySelectorAll('.consequence-card').forEach((card, index) => {
    card.style.opacity = '0';
    card.style.transform = 'translateY(30px)';
    card.style.transition = `all 0.6s ease ${index * 0.1}s`;
    observer.observe(card);
  });

  // Animate stat cards on scroll
  document.querySelectorAll('.stat-card').forEach((card, index) => {
    card.style.opacity = '0';
    card.style.transform = 'translateY(20px)';
    card.style.transition = `all 0.5s ease ${index * 0.2}s`;
    observer.observe(card);
  });
}
