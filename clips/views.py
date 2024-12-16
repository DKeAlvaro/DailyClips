from django.shortcuts import render
from plotly.io import to_html
import plotly.graph_objects as go

from django.http import JsonResponse
from django.views.decorators.csrf import csrf_exempt
from django.core.files.storage import FileSystemStorage


def index(request):
    return render(request, 'clips/index.html')

def your_stats(request):

    stats = {
        '2024-12-01': 5,
        '2024-12-02': 6,
        '2024-12-03': 10,
        '2024-12-04': 9,
        '2024-12-05': 8,
    }

    dates = list(stats.keys())
    scores = list(stats.values())

    fig = go.Figure(data=[go.Scatter(
        x=dates,
        y=scores,
        mode='lines+markers',
        line=dict(color='#42A5F5', width=2),
        marker=dict(size=8, color='#FF1744', symbol='circle-open', line=dict(color='#FF1744', width=2))
    )])

    fig.update_layout(
        xaxis_title='<b>Date</b>',
        yaxis_title='<b>Score</b>',
        xaxis_tickangle=45,
        yaxis_range=[1, 11],
        plot_bgcolor='#FFFFFF',
        paper_bgcolor='#FFFFFF',
        margin=dict(l=50, r=50, b=50, t=50),
        xaxis=dict(tickfont=dict(size=16)),
        yaxis=dict(tickfont=dict(size=16)),
        xaxis_gridcolor='#E5E5EA',
        yaxis_gridcolor='#E5E5EA',
    )

    plot_html = to_html(fig, full_html=False)

    return render(request, 'clips/your_stats.html', {'plot_html': plot_html})
