from flask import Flask, jsonify, render_template, request, make_response
import mysql.connector
import pandas as pd
from config import get_db_connection
import time
import numpy as np

app = Flask(__name__, template_folder='../templates', static_folder='../static')

_cache = {'time': 0, 'df': None}
_cinfo_cache = None
CACHE_TTL = 300

def get_dataframe():
    global _cache
    if _cache['df'] is not None and time.time() - _cache['time'] < CACHE_TTL:
        return _cache['df']
    connection = get_db_connection()
    if not connection: return None
    try:
        df = pd.read_sql("SELECT * FROM covid_data", connection)
        _cache['df'] = df
        _cache['time'] = time.time()
        return df
    finally:
        if connection and connection.is_connected():
            connection.close()

def get_country_info():
    global _cinfo_cache
    if _cinfo_cache is not None:
        return _cinfo_cache
    connection = get_db_connection()
    if not connection: return None
    try:
        _cinfo_cache = pd.read_sql("SELECT country, continent FROM country_info", connection)
        return _cinfo_cache
    finally:
        if connection and connection.is_connected():
            connection.close()

def get_filtered_dataframe():
    df = get_dataframe()
    if df is None: return pd.DataFrame()
    country = request.args.get('country', 'All')
    if country and country != 'All':
        return df[df['country'] == country]
    return df

@app.route('/api/top-countries', methods=['GET'])
def top_countries():
    df = get_filtered_dataframe()
    top_10 = df.groupby('country')['confirmed_cases'].max().sort_values(ascending=False).head(10)
    return jsonify({"countries": top_10.index.tolist(), "cases": top_10.values.tolist()})

@app.route('/api/daily-trend', methods=['GET'])
def daily_trend():
    df = get_filtered_dataframe()
    trend = df.groupby('date')['confirmed_cases'].sum().reset_index().sort_values(by='date')
    return jsonify({"dates": trend['date'].astype(str).tolist(), "cases": trend['confirmed_cases'].tolist()})

@app.route('/api/monthly-trend', methods=['GET'])
def monthly_trend():
    df = get_filtered_dataframe()
    df['date'] = pd.to_datetime(df['date'])
    df['month'] = df['date'].dt.strftime('%Y-%m')
    monthly = df.groupby('month')['confirmed_cases'].sum().reset_index().sort_values(by='month')
    return jsonify({"months": monthly['month'].tolist(), "cases": monthly['confirmed_cases'].tolist()})

@app.route('/api/mortality-ranking', methods=['GET'])
def mortality_ranking():
    df = get_filtered_dataframe()
    grouped = df.groupby('country').agg({'deaths': 'max', 'confirmed_cases': 'max'}).reset_index()
    grouped['mortality_rate'] = (grouped['deaths'] / grouped['confirmed_cases'].replace(0, np.nan)) * 100
    grouped['mortality_rate'] = grouped['mortality_rate'].fillna(0)
    top_10 = grouped.sort_values(by='mortality_rate', ascending=False).head(10)
    return jsonify({"countries": top_10['country'].tolist(), "mortality_rates": top_10['mortality_rate'].round(2).tolist()})

@app.route('/api/recovery-trend', methods=['GET'])
def recovery_trend():
    df = get_filtered_dataframe()
    trend = df.groupby('date')['recovered'].sum().reset_index().sort_values(by='date')
    return jsonify({"dates": trend['date'].astype(str).tolist(), "recovered": trend['recovered'].tolist()})

@app.route('/api/continent-analysis', methods=['GET'])
def continent_analysis():
    df = get_filtered_dataframe()
    c_info = get_country_info()
    if df.empty or c_info is None or c_info.empty:
        return jsonify({"continent": [], "confirmed_cases": []})
    max_cases = df.groupby('country')['confirmed_cases'].max().reset_index()
    merged = pd.merge(max_cases, c_info, on='country', how='inner')
    grouped = merged.groupby('continent')['confirmed_cases'].sum().reset_index().sort_values(by='confirmed_cases', ascending=False)
    return jsonify({"continent": grouped['continent'].tolist(), "confirmed_cases": grouped['confirmed_cases'].tolist()})

@app.route('/api/daily-deaths', methods=['GET'])
def daily_deaths():
    df = get_filtered_dataframe()
    trend = df.groupby('date')['deaths'].sum().reset_index().sort_values('date')
    return jsonify({"dates": trend['date'].astype(str).tolist(), "deaths": trend['deaths'].tolist()})

@app.route('/api/country-deaths', methods=['GET'])
def country_deaths():
    df = get_filtered_dataframe()
    top = df.groupby('country')['deaths'].max().sort_values(ascending=False).head(10)
    return jsonify({"countries": top.index.tolist(), "deaths": top.values.tolist()})

@app.route('/api/recovery-rate', methods=['GET'])
def recovery_rate():
    df = get_filtered_dataframe()
    grouped = df.groupby('country').agg({'recovered': 'max', 'confirmed_cases': 'max'}).reset_index()
    grouped['rate'] = (grouped['recovered'] / grouped['confirmed_cases'].replace(0, np.nan)) * 100
    grouped['rate'] = grouped['rate'].fillna(0)
    top = grouped.sort_values('rate', ascending=False).head(10)
    return jsonify({"countries": top['country'].tolist(), "recovery_rates": top['rate'].round(2).tolist()})

@app.route('/api/cases-vs-deaths', methods=['GET'])
def cases_vs_deaths():
    df = get_dataframe()
    if df is None: return jsonify([])
    grouped = df.groupby('country').agg({'confirmed_cases': 'max', 'deaths': 'max'}).reset_index()
    grouped = grouped.fillna(0)
    top_50 = grouped.sort_values(by='confirmed_cases', ascending=False).head(50)
    return jsonify(top_50.rename(columns={'country': 'country', 'confirmed_cases': 'cases', 'deaths': 'deaths'}).to_dict(orient='records'))

@app.route('/api/cases-vs-deaths-trend', methods=['GET'])
def cases_vs_deaths_trend():
    df = get_filtered_dataframe()
    trend = df.groupby('date').agg({'confirmed_cases': 'sum', 'deaths': 'sum'}).reset_index().sort_values('date')
    return jsonify({
        "dates": trend['date'].astype(str).tolist(), 
        "cases": trend['confirmed_cases'].tolist(),
        "deaths": trend['deaths'].tolist()
    })

@app.route('/api/global-map', methods=['GET'])
def global_map():
    df = get_filtered_dataframe()
    grouped = df.groupby('country').agg({'confirmed_cases': 'max', 'deaths': 'max', 'recovered': 'max'}).reset_index()
    grouped = grouped.fillna(0)
    return jsonify(grouped.to_dict(orient='records'))

@app.route('/api/growth-rate', methods=['GET'])
def growth_rate():
    df = get_filtered_dataframe()
    trend = df.groupby('date')['confirmed_cases'].sum().reset_index().sort_values('date')
    trend['growth'] = trend['confirmed_cases'].diff().fillna(0)
    trend['growth'] = trend['growth'].apply(lambda x: max(0, x))
    return jsonify({"dates": trend['date'].astype(str).tolist(), "growth": trend['growth'].tolist()})

@app.route('/api/all-countries-list', methods=['GET'])
def all_countries_list():
    df = get_dataframe()
    if df is None: return jsonify([])
    return jsonify(sorted(df['country'].unique().tolist()))

@app.route('/api/cases-ranking-race', methods=['GET'])
def cases_ranking_race():
    df = get_dataframe()
    if df is None or df.empty:
        return jsonify([])
    
    df = df.copy()
    df['date'] = pd.to_datetime(df['date'])
    df['month'] = df['date'].dt.strftime('%Y-%m')
    
    # Aggregate max cases per month and country (cumulative cases)
    monthly_data = df.groupby(['month', 'country'])['confirmed_cases'].max().reset_index()
    
    # Get top 10 countries for each month
    # We sort by month (asc) and cases (desc)
    top_10_per_month = monthly_data.sort_values(['month', 'confirmed_cases'], ascending=[True, False])
    top_10_per_month = top_10_per_month.groupby('month').head(10)
    
    # Convert to requested format
    result = top_10_per_month.rename(columns={'confirmed_cases': 'cases'}).to_dict(orient='records')
    return jsonify(result)

@app.route('/api/key-insights', methods=['GET'])
def key_insights():
    df = get_dataframe()
    if df is None or df.empty:
        return jsonify([])
    
    df = df.copy()
    df['date'] = pd.to_datetime(df['date'])
    
    insights = []
    
    # 1. Peak global infection date
    daily_global = df.groupby('date')['confirmed_cases'].sum().diff().fillna(0)
    peak_date = daily_global.idxmax()
    insights.append(f"Global daily cases peaked on {peak_date.strftime('%B %d, %Y')}.")
    
    # 2. Country with highest total confirmed cases
    country_totals = df.groupby('country')['confirmed_cases'].max().sort_values(ascending=False)
    top_country = country_totals.index[0]
    top_cases = country_totals.values[0]
    insights.append(f"{top_country} recorded the highest total cases ({int(top_cases):,}).")
    
    # 3. Country with highest mortality rate (minimum 10,000 cases to avoid outliers)
    mortality = df.groupby('country').agg({'deaths': 'max', 'confirmed_cases': 'max'})
    mortality = mortality[mortality['confirmed_cases'] >= 10000]
    mortality['rate'] = (mortality['deaths'] / mortality['confirmed_cases']) * 100
    top_mortality_country = mortality['rate'].idxmax()
    top_mortality_rate = mortality['rate'].max()
    insights.append(f"{top_mortality_country} has the highest mortality rate among heavily affected nations ({top_mortality_rate:.2f}%).")
    
    # 4. Month with fastest growth in cases
    df['month'] = df['date'].dt.strftime('%Y-%m')
    monthly_global = df.groupby('month')['confirmed_cases'].sum()
    monthly_growth = monthly_global.diff().fillna(0)
    fastest_month_str = monthly_growth.idxmax()
    from datetime import datetime
    fastest_month = datetime.strptime(fastest_month_str, '%Y-%m').strftime('%B %Y')
    insights.append(f"Global cases saw the fastest growth during {fastest_month}.")
    
    # 5. Global recovery rate
    total_confirmed = df.groupby('country')['confirmed_cases'].max().sum()
    total_recovered = df.groupby('country')['recovered'].max().sum()
    if total_confirmed > 0:
        recovery_rate = (total_recovered / total_confirmed) * 100
        insights.append(f"The global recovery rate is currently estimated at {recovery_rate:.1f}%.")
    
    return jsonify(insights)

@app.route('/api/custom-analysis', methods=['GET'])
def custom_analysis():
    df = get_dataframe()
    if df is None or df.empty:
        return jsonify([])
    
    country = request.args.get('country', 'All')
    metric = request.args.get('metric', 'confirmed_cases')
    aggregation = request.args.get('aggregation', 'daily')
    
    # Map valid metrics to dataframe columns
    metric_map = {
        'Confirmed Cases': 'confirmed_cases',
        'Deaths': 'deaths',
        'Recovered': 'recovered'
    }
    
    # Try different key formats (exact match, lowercase, or fallback)
    col_name = metric_map.get(metric, metric_map.get(metric.title(), metric.lower().replace(' ', '_')))
    
    # Ensure column exists
    if col_name not in df.columns:
        # Default to confirmed cases if metric is invalid
        col_name = 'confirmed_cases'
    
    # Filter by country if not 'All'
    filtered_df = df if country == 'All' else df[df['country'] == country]
    
    if filtered_df.empty:
        return jsonify([])
    
    filtered_df = filtered_df.copy()
    
    if aggregation == 'monthly':
        filtered_df['date'] = pd.to_datetime(filtered_df['date'])
        filtered_df['period'] = filtered_df['date'].dt.strftime('%Y-%m')
        # For monthly we usually sum the daily values if it's daily data, or if it's cumulative take max
        # The existing endpoints use sum for daily/monthly trends in this app, so doing sum
        grouped = filtered_df.groupby('period')[col_name].max() if 'cumulative' in col_name else filtered_df.groupby('period')[col_name].sum()
        # If it's already cumulative, sum might be wrong, but in previous code `monthly_trend` used `sum()`
        result = grouped.reset_index().rename(columns={'period': 'date', col_name: 'value'}).sort_values('date')
    else:  # daily
        grouped = filtered_df.groupby('date')[col_name].sum().reset_index()
        result = grouped.rename(columns={col_name: 'value'}).sort_values('date')
        
    return jsonify(result.to_dict(orient='records'))

@app.route('/global-overview')
def global_overview():
    return render_template('global_overview.html')

@app.route('/api/global-cases-trend', methods=['GET'])
def global_cases_trend():
    df = get_dataframe()
    if df is None: return jsonify({"dates": [], "cases": []})
    trend = df.groupby('date')['confirmed_cases'].sum().reset_index().sort_values('date')
    return jsonify({"dates": trend['date'].astype(str).tolist(), "cases": trend['confirmed_cases'].tolist()})

@app.route('/api/global-deaths-trend', methods=['GET'])
def global_deaths_trend():
    df = get_dataframe()
    if df is None: return jsonify({"dates": [], "deaths": []})
    trend = df.groupby('date')['deaths'].sum().reset_index().sort_values('date')
    return jsonify({"dates": trend['date'].astype(str).tolist(), "deaths": trend['deaths'].tolist()})

@app.route('/api/global-recovery-trend', methods=['GET'])
def global_recovery_trend():
    df = get_dataframe()
    if df is None: return jsonify({"dates": [], "recovered": []})
    trend = df.groupby('date')['recovered'].sum().reset_index().sort_values('date')
    return jsonify({"dates": trend['date'].astype(str).tolist(), "recovered": trend['recovered'].tolist()})

@app.route('/api/global-stats', methods=['GET'])
def global_stats():
    df = get_dataframe()
    if df is None: return jsonify({})
    # Get total cases by taking max per country and summing
    country_stats = df.groupby('country').agg({
        'confirmed_cases': 'max',
        'deaths': 'max',
        'recovered': 'max'
    }).sum()
    
    cases = int(country_stats['confirmed_cases'])
    deaths = int(country_stats['deaths'])
    recovered = int(country_stats['recovered'])
    
    mortality = (deaths / cases * 100) if cases > 0 else 0
    recovery = (recovered / cases * 100) if cases > 0 else 0
    
    return jsonify({
        "total_cases": cases,
        "total_deaths": deaths,
        "total_recovered": recovered,
        "mortality_rate": round(mortality, 2),
        "recovery_rate": round(recovery, 2)
    })

@app.route('/country-analytics')
def country_analytics():
    return render_template('country_analytics.html')

@app.route('/api/country-data', methods=['GET'])
def country_data():
    df = get_dataframe()
    if df is None: return jsonify([])
    country = request.args.get('country')
    if not country: return jsonify([])
    
    filtered = df[df['country'] == country].sort_values('date')
    if filtered.empty: return jsonify([])
    
    # Calculate KPIs for the country
    total_cases = int(filtered['confirmed_cases'].max())
    total_deaths = int(filtered['deaths'].max())
    total_recovered = int(filtered['recovered'].max())
    
    mortality_rate = round((total_deaths / total_cases * 100), 2) if total_cases > 0 else 0
    recovery_rate = round((total_recovered / total_cases * 100), 2) if total_cases > 0 else 0
    
    # Calculate daily growth
    filtered['growth'] = filtered['confirmed_cases'].diff().fillna(0)
    
    return jsonify({
        "kpis": {
            "total_cases": total_cases,
            "total_deaths": total_deaths,
            "recovery_rate": recovery_rate,
            "mortality_rate": mortality_rate
        },
        "trends": {
            "dates": filtered['date'].astype(str).tolist(),
            "cases": filtered['confirmed_cases'].tolist(),
            "deaths": filtered['deaths'].tolist(),
            "recovered": filtered['recovered'].tolist(),
            "growth": filtered['growth'].tolist()
        }
    })

@app.route('/trends')
def trends():
    return render_template('trends.html')

@app.route('/reports')
def reports():
    return render_template('reports.html')

@app.route('/settings')
def settings():
    return render_template('settings.html')

@app.route('/api/full-export', methods=['GET'])
def full_export():
    df = get_dataframe()
    if df is None: return "Internal Server Error", 500
    
    # Return as CSV
    from io import StringIO
    output = StringIO()
    df.to_csv(output, index=False)
    
    response = make_response(output.getvalue())
    response.headers["Content-Disposition"] = "attachment; filename=covid19_full_dataset.csv"
    response.headers["Content-type"] = "text/csv"
    return response

@app.route('/api/analytics-summary', methods=['GET'])
def get_analytics_summary():
    df = get_dataframe()
    if df is None: return jsonify({})
    
    df['date'] = pd.to_datetime(df['date'])
    
    # Global Totals
    total_confirmed = df.groupby('country')['confirmed_cases'].max().sum()
    total_deaths = df.groupby('country')['deaths'].max().sum()
    total_recovered = df.groupby('country')['recovered'].max().sum()
    
    # Peak Daily Cases (Global)
    daily_global = df.groupby('date')['confirmed_cases'].sum().diff().fillna(0)
    peak_val = daily_global.max()
    peak_date = daily_global.idxmax()
    
    # Top 3 Countries
    top_3 = df.groupby('country')['confirmed_cases'].max().sort_values(ascending=False).head(3).to_dict()
    
    return jsonify({
        "totals": {
            "cases": int(total_confirmed),
            "deaths": int(total_deaths),
            "recovered": int(total_recovered)
        },
        "peak": {
            "value": int(peak_val),
            "date": peak_date.strftime('%Y-%m-%d')
        },
        "top_countries": top_3,
        "last_update": df['date'].max().strftime('%Y-%m-%d')
    })

@app.route('/api/monthly-trend', methods=['GET'])
def get_monthly_trend():
    df = get_dataframe()
    if df is None: return jsonify([])
    df = df.copy()
    df['date'] = pd.to_datetime(df['date'])
    df['month'] = df['date'].dt.strftime('%Y-%m')
    
    # Global monthly accumulation (max cases per month globally)
    monthly = df.groupby('month')['confirmed_cases'].sum().reset_index().sort_values('month')
    return jsonify({
        "labels": monthly['month'].tolist(),
        "cases": monthly['confirmed_cases'].tolist()
    })

@app.route('/api/growth-rate', methods=['GET'])
def get_growth_rate():
    df = get_dataframe()
    if df is None: return jsonify([])
    
    global_daily = df.groupby('date')['confirmed_cases'].sum().reset_index().sort_values('date')
    global_daily['daily_new'] = global_daily['confirmed_cases'].diff().fillna(0)
    # Volatility / percentage growth
    global_daily['growth_rate'] = (global_daily['daily_new'] / global_daily['confirmed_cases'].shift(1) * 100).fillna(0)
    
    # Filter out extreme outliers (e.g. data corrections)
    global_daily.loc[global_daily['growth_rate'] > 100, 'growth_rate'] = 0
    
    return jsonify({
        "labels": global_daily['date'].astype(str).tolist(),
        "growth_rate": global_daily['growth_rate'].tolist()
    })

@app.route('/api/moving-average', methods=['GET'])
def get_moving_average():
    df = get_dataframe()
    if df is None: return jsonify([])
    
    global_daily = df.groupby('date').agg({
        'confirmed_cases': 'sum',
        'deaths': 'sum'
    }).reset_index().sort_values('date')
    
    global_daily['new_cases'] = global_daily['confirmed_cases'].diff().fillna(0)
    global_daily['new_deaths'] = global_daily['deaths'].diff().fillna(0)
    
    global_daily['ma_cases'] = global_daily['new_cases'].rolling(window=7).mean().fillna(0)
    global_daily['ma_deaths'] = global_daily['new_deaths'].rolling(window=7).mean().fillna(0)
    
    return jsonify({
        "labels": global_daily['date'].astype(str).tolist(),
        "ma_cases": global_daily['ma_cases'].tolist(),
        "ma_deaths": global_daily['ma_deaths'].tolist()
    })

@app.route('/api/bar-race', methods=['GET'])
def get_bar_race():
    df = get_dataframe()
    if df is None: return jsonify([])
    df = df.copy()
    df['date'] = pd.to_datetime(df['date'])
    df['month'] = df['date'].dt.strftime('%Y-%m')
    
    # Get top 10 countries for each month
    results = []
    months = sorted(df['month'].unique())
    
    for month in months:
        month_data = df[df['month'] == month]
        top_10 = month_data.groupby('country')['confirmed_cases'].max().sort_values(ascending=False).head(10)
        results.append({
            "month": month,
            "data": [{"country": c, "value": v} for c, v in top_10.items()]
        })
        
    return jsonify(results)

@app.route('/')
def index():
    return render_template('index.html')
