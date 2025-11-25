# Deployment Guide: Istanbul Transport Crowding API

This guide provides instructions for deploying the FastAPI backend using Docker and Docker Compose. This setup includes a PostgreSQL database that is automatically populated on the first run.

## Prerequisites

- **Docker:** You must have Docker installed on your system. Docker provides an isolated environment to run applications, ensuring consistency across different machines.
  - [Install Docker Desktop](https://www.docker.com/products/docker-desktop/) (for Mac, Windows, and Linux).

## Running the Application

The entire backend stack (API + Database) can be started with a single command.

1.  **Navigate to the Project Root:**
    Open your terminal and change the directory to the root of this project.

2.  **Build and Run the Containers:**
    Execute the following command:
    ```bash
    docker-compose up --build
    ```
    - `docker-compose up`: This command starts the services defined in the `docker-compose.yml` file (`api` and `db`).
    - `--build`: This flag forces Docker to rebuild the API image from the `Dockerfile`, ensuring any code changes are included.

3.  **Verify the API is Running:**
    - Once the containers are up and running, the API will be accessible at `http://localhost:8000`.
    - You can access the interactive API documentation (Swagger UI) at `http://localhost:8000/docs`.

## Database Auto-Population

- On the very first launch, the `api` service will automatically connect to the `db` service.
- It checks if the `transport_lines` table is empty.
- If it is empty, the script located at `src/api/utils/init_db.py` will load the `data/processed/transport_meta.parquet` file and bulk-insert its contents into the PostgreSQL database.
- On subsequent launches, the script will detect that the data already exists and will skip the population step.

## Troubleshooting

- **Connection Issues to `db` service:**
  - **Error Message:** You might see errors like `Is the server running on host "db" (172.23.0.2) and accepting TCP/IP connections on port 5432?`
  - **Solution:** This usually happens if the `api` container starts before the `db` container is fully ready. The `healthcheck` in `docker-compose.yml` is designed to prevent this, but if issues persist, try stopping and restarting the containers:
    ```bash
    docker-compose down
    docker-compose up
    ```

- **Port Conflicts:**
  - **Error Message:** If you see an error indicating that port `8000` or `5432` is already in use.
  - **Solution:** Stop the application that is using the conflicting port, or change the port mapping in the `docker-compose.yml` file. For example, to run the API on port 8001, change `ports: - "8000:8000"` to `ports: - "8001:8000"`.

- **Data Volume Issues:**
  - If you want to start with a fresh, empty database, you can remove the Docker volume that persists the PostgreSQL data.
  - **Warning:** This will permanently delete all data in your database.
    ```bash
    docker-compose down
    docker volume rm ibb-transport_postgres_data
    docker-compose up --build
    ```
