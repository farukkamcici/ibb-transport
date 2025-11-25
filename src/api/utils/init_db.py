import pandas as pd
from sqlalchemy.orm import Session
from ..db import engine
from ..models import Base, TransportLine

def init_db(db: Session):
    print("Checking database...")
    # Create tables if they don't exist
    Base.metadata.create_all(bind=engine)

    # Check if the transport_lines table is empty
    if db.query(TransportLine).count() == 0:
        print("Database is empty. Populating from parquet file...")
        try:
            # Load data from parquet file
            df = pd.read_parquet('data/processed/transport_meta.parquet')
            
            # Use a bulk insert for efficiency
            db.bulk_insert_mappings(TransportLine, df.to_dict(orient='records'))
            db.commit()
            print("Database populated successfully.")
        except FileNotFoundError:
            print("Error: transport_meta.parquet not found. Cannot populate database.")
        except Exception as e:
            print(f"An error occurred during database population: {e}")
            db.rollback()
    else:
        print("Database already contains data.")
