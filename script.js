document.addEventListener('DOMContentLoaded', () => {
    const newsGrid = document.getElementById('news-grid');
    const modal = document.getElementById('modal');
    const closeModalBtn = document.getElementById('close-modal');
    const loader = document.querySelector('.loader-wrapper');
    const currentDateEl = document.getElementById('current-date');
    const nameDayEl = document.getElementById('name-day-name');

    // Set Date
    const updateDate = () => {
        const now = new Date();
        const options = { day: 'numeric', month: 'long', year: 'numeric' };
        currentDateEl.textContent = now.toLocaleDateString('cs-CZ', options);
    };
    updateDate();

    // Fetch Name Day from API
    async function updateNameDay() {
        try {
            const response = await fetch('https://svatkyapi.cz/api/day');
            if (!response.ok) throw new Error('API request failed');
            const data = await response.json();
            nameDayEl.textContent = data.name;
        } catch (error) {
            console.error('Error fetching name day:', error);
            // Static fallback
            nameDayEl.textContent = 'ERROR';
        }
    }
    updateNameDay();

    let allNews = [];

    // Fetch News
    async function init() {
        try {
            const response = await fetch('news.txt');
            allNews = await response.json();
            
            setupFilters(allNews);
            
            // Initial render
            const processedNews = assignDynamicSizes([...allNews]);
            renderNews(processedNews);
            
            // Hide Loader
            setTimeout(() => {
                loader.classList.add('fade-out');
            }, 800);

        } catch (error) {
            console.error('Error loading news:', error);
            newsGrid.innerHTML = '<p style="grid-column: 1/-1; text-align: center;">Nepodařilo se načíst novinky. Zkuste to prosím později.</p>';
            loader.classList.add('fade-out');
        }
    }

    function setupFilters(news) {
        const filterContainer = document.getElementById('category-filter');
        const categories = [...new Set(news.map(item => item.category))];
        
        categories.forEach(cat => {
            const btn = document.createElement('button');
            btn.className = 'filter-btn';
            btn.dataset.category = cat;
            btn.textContent = cat;
            filterContainer.appendChild(btn);
        });

        const filterBtns = document.querySelectorAll('.filter-btn');
        filterBtns.forEach(btn => {
            btn.addEventListener('click', () => {
                const category = btn.dataset.category;
                
                // Update active state
                filterBtns.forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                
                // Filter news
                const filteredNews = category === 'all' 
                    ? [...allNews] 
                    : allNews.filter(item => item.category === category);
                
                // Re-assign sizes and render
                const processedNews = assignDynamicSizes(filteredNews);
                renderNews(processedNews);
            });
        });
    }

    function assignDynamicSizes(news) {
        const columns = 4;
        const grid = []; // 2D array tracking occupied cells

        function isOccupied(x, y) {
            return grid[y] && grid[y][x];
        }

        function canFit(x, y, w, h) {
            if (x + w > columns) return false;
            for (let i = y; i < y + h; i++) {
                for (let j = x; j < x + w; j++) {
                    if (isOccupied(j, i)) return false;
                }
            }
            return true;
        }

        function markOccupied(x, y, w, h) {
            for (let i = y; i < y + h; i++) {
                if (!grid[i]) grid[i] = new Array(columns).fill(false);
                for (let j = x; j < x + w; j++) {
                    grid[i][j] = true;
                }
            }
        }

        function getFirstEmpty() {
            let y = 0;
            while (true) {
                if (!grid[y]) grid[y] = new Array(columns).fill(false);
                for (let x = 0; x < columns; x++) {
                    if (!grid[y][x]) return { x, y };
                }
                y++;
            }
        }

        // 1. Shuffle original array
        for (let i = news.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [news[i], news[j]] = [news[j], news[i]];
        }

        // 2. Assign sizes by filling the grid greedily
        let largeCount = 0;
        const targetLarge = 2;

        news.forEach((item, index) => {
            const { x, y } = getFirstEmpty();
            
            const possibleSizes = [];
            
            // Adjust weights to ensure we get some large cards
            let largeWeight = 1.5;
            if (largeCount < targetLarge) {
                // If we still need large cards, increase the weight significantly
                largeWeight = 10;
            }

            if (canFit(x, y, 2, 2)) possibleSizes.push({ name: 'large', w: 2, h: 2, weight: largeWeight });
            if (canFit(x, y, 2, 1)) possibleSizes.push({ name: 'medium', w: 2, h: 1, weight: 3.5 });
            if (canFit(x, y, 1, 1)) possibleSizes.push({ name: 'small', w: 1, h: 1, weight: 5 });

            let totalWeight = possibleSizes.reduce((acc, s) => acc + s.weight, 0);
            let random = Math.random() * totalWeight;
            let selectedSize = possibleSizes[possibleSizes.length - 1];
            
            for (const size of possibleSizes) {
                random -= size.weight;
                if (random <= 0) {
                    selectedSize = size;
                    break;
                }
            }

            if (selectedSize.name === 'large') largeCount++;

            item.size = selectedSize.name;
            markOccupied(x, y, selectedSize.w, selectedSize.h);
        });

        return news;
    }

    function renderNews(news) {
        newsGrid.innerHTML = '';
        
        news.forEach((item, index) => {
            const card = document.createElement('div');
            card.className = `news-card ${item.size}`;
            if (!item.image) card.classList.add('no-image');
            
            const imageHtml = item.image 
                ? `<img src="${item.image}" alt="${item.title}" class="card-image" onload="this.classList.add('loaded')" onerror="this.closest('.news-card').classList.add('no-image'); this.remove();">`
                : '';
            
            card.innerHTML = `
                ${imageHtml}
                <div class="card-overlay"></div>
                <div class="card-content">
                    <span class="card-category">${item.category || 'Novinka dne'}</span>
                    <h2 class="card-title">${item.title}</h2>
                    <p class="card-summary">${item.summary}</p>
                </div>
            `;
            
            card.addEventListener('click', () => {
                openModal();
            });
            
            newsGrid.appendChild(card);
            
            // Staggered animation
            setTimeout(() => {
                card.classList.add('show');
            }, index * 60 + 100);
        });
    }

    function openModal() {
        modal.classList.add('active');
        document.body.style.overflow = 'hidden';
    }

    function closeModal() {
        modal.classList.remove('active');
        document.body.style.overflow = '';
    }

    closeModalBtn.addEventListener('click', closeModal);
    
    // Close on overlay click
    modal.addEventListener('click', (e) => {
        if (e.target === modal) closeModal();
    });

    init();
});
