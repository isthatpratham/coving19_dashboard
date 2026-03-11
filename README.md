# COVID-19 Data Analytics and Visualization Dashboard

## Project Description
A full-stack data analytics and visualization dashboard that tracks and analyzes global COVID-19 metrics from the Johns Hopkins time-series dataset. 

This project provides an intuitive web interface built with a Flask API backend and an interactive Bootstrap frontend with dynamic Chart.js visualizations. Key features include tracking the top affected countries, daily/monthly global trends, mortality rate rankings, and continent-level analysis.

## Technology Stack
- **Backend**: Python Flask
- **Database**: MySQL (XAMPP)
- **Data Processing**: Pandas, NumPy
- **Visualizations (Python)**: Matplotlib, Seaborn
- **Visualizations (Web)**: Chart.js
- **Frontend UI**: Bootstrap, HTML, CSS, JavaScript

## Installation Steps
Follow these instructions to set up and run the project locally.

**1. Install XAMPP and start MySQL**
Ensure Apache and MySQL are running from the XAMPP Control Panel.

**2. Create database `covid19`**
Open phpMyAdmin (usually `http://localhost/phpmyadmin`) and create a database named `covid19`.

**3. Run database schema SQL**
Import and execute the `schema.sql` file provided in the root directory into the `covid19` database to set up the necessary tables and populate the initial `country_info` geographic data.

**4. Install Python dependencies**
Open a terminal in the project root folder and run:
```bash
pip install -r requirements.txt
```

**5. Prepare dataset**
Execute the data cleaning script to format the raw CSV files for database insertion.
```bash
python scripts/prepare_dataset.py
```

**6. Load dataset into MySQL**
Execute the data loading script exactly once to batch-insert the cleaned data securely to your local MySQL database. Note: It may take some time depending on your hardware.
```bash
python scripts/load_data_mysql.py
```

**7. Run the project**
To launch the full dashboard and API server, simply execute:
```bash
python run_project.py
```

Co-authored by: Krishanu Mondal <avim68221@gmail.com>

## Accessing the Dashboard
Once the Flask server is running, the dashboard is available locally in your web browser. 
**URL**: [http://127.0.0.1:5000](http://127.0.0.1:5000)
