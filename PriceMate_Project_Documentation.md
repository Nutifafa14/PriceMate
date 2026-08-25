# PriceMate: Market Price Monitoring and Prediction System for Ghana

## Chapter 1 – Introduction

### 1.1 Project Title
PriceMate: Market Price Monitoring and Prediction System for Ghana

### 1.2 Problem Statement
Ghanaian food markets often suffer from fragmented, inconsistent, and delayed access to price information. Farmers, traders, businesses, and consumers frequently struggle to compare prices across markets, understand price trends over time, and make critical decisions based on credible market intelligence. In many cases, information is scattered, outdated, or unavailable in a single reliable source.

This issue affects both supply-side and demand-side actors. Producers may sell goods at poor prices because they lack market visibility, while buyers may overpay because they do not have timely information on local price differences. These information gaps often result in inefficient trading and poor market coordination.

PriceMate solves this challenge by providing a digital platform that centralizes commodity price data, displays price trends, and uses predictive analysis to support future market decisions. The system makes market information more accessible, transparent, and useful for decision-making.

### 1.3 Aim
The aim of this project is to design and implement an intelligent market price monitoring and prediction system for Ghanaian commodity markets.

### 1.4 Specific Objectives
The project is designed to achieve the following objectives:

- Develop a mobile-friendly platform for viewing commodity prices across multiple markets.
- Organize and present historical price data in a usable format.
- Allow users to compare prices between different markets and commodities.
- Support user authentication and personalized app usage.
- Enable favorites and quick access to selected items.
- Implement a backend API for serving market and price data.
- Use machine learning to estimate future price movements.
- Integrate the frontend, backend, and ML systems into one end-to-end application.

### 1.5 Justification and Motivation
This project was chosen because price information is a critical factor in agricultural and commercial decision-making. In many market environments, relevant price data is not centralized, consistent, or easily accessible. This makes it difficult for people to understand market conditions and plan appropriately.

The motivation behind PriceMate is to reduce uncertainty by offering users access to structured market intelligence. A system like this can help farmers make better selling decisions, traders choose better markets, and businesses plan purchases more effectively. It also supports research and analysis in the agricultural supply chain.

This project is also relevant because it combines several modern technology areas: mobile application development, backend services, system design, data processing, and machine learning. It reflects a realistic software engineering problem where multiple layers must work together in a coherent system.

### 1.6 Scope
The project includes the following components:

- market and commodity browsing,
- historical price analysis,
- price comparison across regions,
- user account creation and authentication,
- favorites and saved preferences,
- prediction capabilities for future prices,
- secure backend communication,
- machine learning-based forecasting.

The project does not include:

- direct trading execution,
- full supply-chain logistics management,
- live scraping from every market in Ghana,
- full enterprise-level distributed deployment,
- advanced financial simulation beyond pricing prediction.

### 1.7 Limitations
The project has several limitations that should be recognized:

- The prediction model depends on the quality and completeness of its dataset.
- Some commodities are more volatile than others, especially fresh produce, which makes forecasting more difficult.
- Real-world price changes may be influenced by weather, transport disruption, fuel prices, and policy changes beyond the model’s training inputs.
- Forecasting is probabilistic and should be interpreted as an estimate rather than a guaranteed outcome.
- The system is designed to support practical decisions, but it does not replace full economic analysis for high-risk decisions.

### 1.8 Beneficiaries
The system benefits several groups, including:

- farmers,
- traders,
- retailers,
- buyers,
- researchers,
- policymakers,
- students,
- businesses involved in food and commodity markets.

These stakeholders rely on timely and accurate price information to make informed decisions. PriceMate provides a better way to access and interpret that information.

### 1.9 Academic and Practical Relevance
This project is academically relevant because it demonstrates the integration of real-world data processing, system architecture, and machine learning in a single application. It shows how raw information can be transformed into practical decision-support tools through software engineering and analytics.

It is also practically relevant because it addresses a real societal and economic issue: lack of transparent and centralized market intelligence. The system transforms raw data into an operational tool that supports planning, comparison, and forecasting.

### 1.10 Rough Project Timeline
A practical implementation timeline for the project can be structured as follows:

- Week 1–2: Requirements gathering and project planning
- Week 3–4: Data acquisition and cleaning
- Week 5–6: System design and database modeling
- Week 7–8: Backend development and API implementation
- Week 9–10: Frontend mobile app development
- Week 11–12: Machine learning model training and evaluation
- Week 13: Integration of frontend, backend, and model
- Week 14: Testing, bug fixes, and refinement
- Week 15: Final documentation and presentation

---

## Chapter 4 – Implementation and Results

### 4.1 Overview of the Implementation
The project was implemented as a layered system with clearly separated responsibilities. These layers are:

1. Frontend layer
   - Handles user interaction
   - Displays market and commodity data
   - Provides app navigation and user interfaces
   - Connects to the backend through structured API calls

2. Backend layer
   - Provides authentication and API services
   - Queries and manages market and commodity data
   - Handles business logic
   - Calls the ML prediction service when needed

3. Data layer
   - Stores and retrieves structured market information
   - Ensures data consistency and completeness
   - Uses cleaned and validated data

4. Machine learning layer
   - Trains a forecasting model
   - Uses historical price patterns to estimate future values
   - Returns predictions with ranges and confidence indicators

This separation makes the system easier to maintain and more realistic for deployment in a production-like environment.

### 4.2 Development Tools and Environment
The system was implemented using a modern technology stack. The tools used include:

- Frontend: React Native with Expo
- Language: TypeScript
- Routing: Expo Router
- State management: Zustand
- Data fetching: React Query
- Secure session handling: Secure Store
- Backend: Node.js with Express
- Database: PostgreSQL
- Validation: structured schema validation
- Machine learning: Python
- Prediction API: FastAPI
- Data processing: pandas
- ML libraries: scikit-learn
- Testing: real backend and ML tests
- Dependency management: npm and Python virtual environment

This environment was selected because it supports a realistic, modular, and scalable project architecture.

### 4.3 Actual Program Modules and Components
The project contains several functional modules across the codebase.

#### Frontend modules
- App navigation and layout
- Authentication screens
- Home and dashboard interfaces
- Market and commodity pages
- Detail screens for selected items
- History and prediction views
- Settings and profile screens
- Theme and reusable UI components
- API hooks and local state stores

#### Backend modules
- Express application setup
- Authentication routes
- Market routes
- Commodity routes
- Price routes
- Prediction routes
- Database connection configuration
- Middleware for validation, security, and error handling
- Forecast pipeline logic
- Dataset seed and import scripts

#### Machine learning modules
- Data preprocessing
- Feature engineering
- Model training and evaluation
- Forecast pipeline handling
- Prediction API service
- Metadata and backtest artifacts

These modules reflect the actual structure of the project and show the complete software pipeline from data to user-facing application.

### 4.4 Flow of the System
The system operates as an end-to-end flow:

1. The user opens the mobile app.
2. The app checks the user session and redirects to auth or home as needed.
3. The app requests market and commodity data through frontend hooks.
4. The backend reads records from the database and returns them in JSON format.
5. The user explores price information and views historical patterns.
6. If the user requests a forecast, the backend sends the request to the ML service.
7. The ML service uses the trained model and relevant inputs to generate a prediction.
8. The backend stores the prediction and returns the result with a range and confidence.
9. The app displays the result to the user in an understandable way.

This flow demonstrates that the system is not only a visual dashboard. It is a functioning application with a real data pipeline and decision-support layer.

### 4.5 Algorithms and Implementation Logic
The implementation uses several key algorithms and design decisions:

- Data cleaning and validation to prepare the dataset
- Feature engineering for market, commodity, month, and year
- Chronological data splitting to test the model realistically
- Comparison of baseline and candidate regression models
- Selection of the best-performing model based on evaluation metrics
- Range-based forecasting instead of relying on a single point estimate
- Confidence labeling to communicate uncertainty
- Use of contextual economic signals in the prediction pipeline

The prediction model is not simply an average of past prices; it uses structured variables and a trained regression method to estimate future values based on historical patterns.

### 4.6 Actual Results
The results from the implemented model evaluation show that the system achieves meaningful forecasting performance, though not perfect accuracy.

The selected model was a Random Forest regressor. Its evaluation results on the held-out chronological test set were:

- Mean Absolute Error (MAE): 188.15 GHS
- Root Mean Square Error (RMSE): 330.37 GHS
- R-squared (R²): 0.432
- Mean Absolute Percentage Error (MAPE): 58.5%

These values show that the system can estimate price levels with reasonable reliability, particularly for more stable commodities. However, the results also show that some categories are harder to predict. In particular, highly volatile fresh produce produces higher percentage errors because their prices fluctuate more sharply due to environmental and short-term market conditions.

This is one of the strengths of the implementation: it does not hide uncertainty. Instead, it clearly indicates that performance varies by commodity type and that the forecast should be used as an estimation tool rather than a certainty.

### 4.7 Result Interpretation
The results show that the model performs best for more stable and storable commodity categories, while being less reliable for highly perishable or unstable goods. This is consistent with the reality of agricultural markets, where supply shocks and seasonal variation can significantly affect prices.

The project therefore presents predictions with:

- a central estimate,
- a low range,
- a high range,
- a confidence label,
- an explanation of the influencing factors.

This makes the system more useful and more trustworthy than a raw number output with no context.

### 4.8 Actual Functional Evidence
The working system was validated through real backend and prediction testing. The project includes testing that confirms:

- valid prediction requests for supported commodities work correctly,
- a prediction can be created and returned successfully,
- the system returns a price range and explanatory metadata,
- unsupported or invalid items are rejected,
- malformed or out-of-range input is handled appropriately,
- the system distinguishes between supported wholesale categories and unsupported cases.

This confirms that the project is not only designed conceptually; it works as an operational system with real validation.

### 4.9 Benefits of the System
PriceMate provides several practical benefits:

- It improves market transparency by centralizing price information.
- It helps users compare market conditions across several regions.
- It supports better financial and planning decisions for farmers and traders.
- It gives users a practical way to understand historical trends.
- It provides data-driven forecasting to support future planning.
- It demonstrates the successful integration of mobile app development, backend services, and AI.
- It creates a foundation that can be extended into a broader market intelligence platform.

The system is especially valuable because it combines useful data access with intelligent analysis. Instead of only showing current prices, it helps users understand patterns and estimate future movements.

### 4.10 Conclusion
The implementation of PriceMate demonstrates that a real-world agricultural market intelligence system can be built using modern software development practices and machine learning. The project integrates a mobile frontend, a backend data service, and a forecasting engine to solve a real market problem in Ghana.

The results show that the system can provide meaningful predictions, especially for stable commodities, while also communicating the uncertainty involved in volatile markets. This combination of modeling and transparency is a major strength of the system and makes it a suitable foundation for continued development.

---

## Final Summary
PriceMate is a practical and technically strong project that brings together market data, software engineering, and machine learning to solve a real problem in Ghanaian commodity pricing. It is useful for users who need price awareness, trend analysis, and forecasting support. The project demonstrates the value of building data-driven products that combine usability, intelligence, and real-world relevance.

This system serves as a strong example of how software development, data analysis, and AI can be combined to build a meaningful tool for agricultural and market decision-making.
