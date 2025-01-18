import os
from heroku3 import from_key

heroku_api_key = os.getenv('HEROKU_API_KEY')
heroku_app_name = os.getenv('HEROKU_APP_NAME')

def restart_app():
    heroku_conn = from_key(heroku_api_key)
    app = heroku_conn.apps()[heroku_app_name]
    app.restart()

if __name__ == "__main__":
    restart_app() 