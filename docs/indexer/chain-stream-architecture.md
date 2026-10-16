# Chain Stream Ingestion Architecture
Listens to Injective gRPC stream at 650ms intervals.
Maintains an in-memory lock-free ring buffer of fills to prevent backpressure.
