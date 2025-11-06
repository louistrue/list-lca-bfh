# 🌱 List-LCA: Construction Material Environmental Impact Calculator

[![Next.js](https://img.shields.io/badge/Next.js-15.1.4+-000000?style=for-the-badge&logo=next.js&logoColor=white)](https://nextjs.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.0+-3178C6?style=for-the-badge&logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![License](https://img.shields.io/badge/license-MIT-green?style=for-the-badge)](LICENSE)

A modern web application that helps students and professionals calculate the environmental impact of construction materials using the official KBOB LCA database.

## 🎯 Features

- 🔍 Instant material search with fuzzy matching
- 📊 Calculate CO2 emissions, UBP (environmental impact points), and energy consumption
- 📥 Import data from Excel/CSV files
- 📤 Export results for further analysis
- 🌐 Multi-language support (DE/FR)
- 🎨 Modern UI with dark mode support

## 🚀 Getting Started

### Prerequisites

- Node.js 18+
- An API key from [LCAdata.ch](https://www.lcadata.ch)

### Installation

1. Clone the repository:

```bash
git clone https://github.com/louistrue/list-lca-bfh.git
cd list-lca-bfh
```

2. Install dependencies:

```bash
npm install
```

3. Create a `.env.local` file and add your LCAdata.ch API key:

```env
LCADATA_API_KEY=your_api_key_here
```

4. Start the development server:

```bash
npm run dev
```

Visit [http://localhost:3000](http://localhost:3000) to see the application.

## 📄 CSV File Requirements

The application accepts CSV files with the following specifications:

### Required Columns

Your CSV file must contain three types of information:

- A column for building elements/components
- A column for material names
- A column for quantities (numeric values)

### Format Requirements

- File must be in CSV format
- UTF-8 encoding recommended
- First row should contain column headers
- Decimal numbers should use point (.) as separator
- Quantity values must be numeric

### Example Structure

```csv
Building Element,Material,Quantity
Wall,Concrete,100
Roof,Steel,200
```

### Units

The application supports two units for quantities:

- Kilograms (kg)
- Cubic meters (m³)

During import, you'll be able to:

1. Map your columns to the required fields
2. Select the unit (kg or m³) for your quantities
3. Preview your data before processing

### Tips

- Material names should be as specific as possible for better matching
- Ensure quantity values are clean numbers without units in the cells
- Column names can be in any language
- Multiple columns with the same name are supported and will be numbered automatically

## 🔑 API Access

This project uses [LCAdata.ch API](https://www.lcadata.ch) to fetch environmental impact data for construction materials. The API provides access to the KBOB database, which is the Swiss standard for construction material life cycle assessment data.

Feel free to reach out to me if you need an API key.

## 📚 Learn More

- [KBOB Ökobilanzdaten](https://www.kbob.admin.ch/de/oekobilanzdaten-im-baubereich) - Official source for Swiss construction LCA data
- [Next.js Documentation](https://nextjs.org/docs) - Learn about Next.js features
- [LCAdata.ch API Documentation](https://www.lcadata.ch/api-docs) - Explore the API endpoints

## 🤝 Contributing

Contributions are welcome! Please feel free to submit a Pull Request. For major changes, please open an issue first to discuss what you would like to change.

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🙏 Acknowledgments

- [KBOB](https://www.kbob.admin.ch/) for providing the LCA database
- [LCAdata.ch](https://www.lcadata.ch) for the API access
- All contributors who help improve this project
